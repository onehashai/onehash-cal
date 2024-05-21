import type { NextApiRequest, NextApiResponse } from "next";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import prisma from "@calcom/prisma";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession({ req, res });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!session.user?.id) {
    console.error("Session is missing a user id.");
    return res.status(500).json({ error: ErrorCode.InternalServerError });
  }

  const accounts = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: true },
  });

  if (!accounts) {
    console.error("Account is missing.");
    return res.status(200).json({ message: "No Session Info." });
  }
  let accessToken;
  accounts.accounts.forEach((account) => {
    accessToken = account.access_token;
  });

  if (!accessToken) {
    console.error("Access Token is missing.");
    return res.status(500).json({ error: ErrorCode.InternalServerError });
  }

  const clientId = process.env.KEYCLOAK_CLIENT_ID || "";
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || "";
  const introspectEndpoint = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token/introspect`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token: accessToken,
  });
  const introspectRes = await fetch(introspectEndpoint, {
    method: "POST",
    body: params.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const introspectData = await introspectRes.json();
  if (introspectData.active === false) {
    // Session expired, delete the account
    await prisma.account.deleteMany({
      where: { userId: session.user.id },
    });
    return res.status(200).json({ message: "Session expired. Please log in again." });
  } else {
    return res.status(200).json({ message: "Session is active" });
  }
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
