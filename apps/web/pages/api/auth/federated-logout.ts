import type { NextApiRequest, NextApiResponse } from "next";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import prisma from "@calcom/prisma";

const logoutUserFromKeycloak = async (refresh_token: string, access_token: string) => {
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  const endsessionURL = new URL(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);

  try {
    const response = await fetch(endsessionURL, {
      method: "POST",
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh_token,
      }),
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.status;
  } catch (err) {
    console.log(err);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    return res.status(500).json({ error: ErrorCode.InternalServerError });
  }
  let refreshToken;
  let accessToken;
  accounts.accounts.forEach((account) => {
    refreshToken = account.refresh_token;
    accessToken = account.access_token;
  });
  if (refreshToken && accessToken) {
    try {
      const result = await logoutUserFromKeycloak(refreshToken, accessToken);
      if (result === 200) {
        return res.status(200).json({ result });
      }
      return res.status(500).json({ message: "Invalid Response from Keycloak" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error });
    }
  } else {
    return res.status(400).json({ message: "Refresh Token missing or invalid" });
  }
}
