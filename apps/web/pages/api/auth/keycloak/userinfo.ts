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

  const userInfoEndpoint = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/userinfo`;
  const keycloak_token = req.cookies["keycloak_token"];
  if (!keycloak_token) {
    return res.status(200).json({ message: "Access Token absent. Please log in again." });
  }
  const keycloak_session = await prisma.keycloakSessionInfo.findUnique({
    where: {
      browserToken: req.cookies["keycloak_token"],
    },
  });
  if (!keycloak_session) {
    return res.status(200).json({ message: "Keycloak Session not found. Please log in again." });
  }
  const access_token = keycloak_session.metadata?.access_token;
  const userInfoRes = await fetch(userInfoEndpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (userInfoRes.status !== 200) {
    await prisma.keycloakSessionInfo.delete({
      where: {
        browserToken: req.cookies["keycloak_token"],
      },
    });
    return res.status(200).json({ message: "Session expired. Please log in again." });
  } else {
    return res.status(200).json({ message: "Session is active" });
  }
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
