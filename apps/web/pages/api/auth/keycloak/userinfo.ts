import type { NextApiRequest, NextApiResponse } from "next";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { symmetricDecrypt } from "@calcom/lib/crypto";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";

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
  const keycloak_token_secret = process.env.CALENDSO_ENCRYPTION_KEY || "";
  const access_token = symmetricDecrypt(req.cookies["keycloak-access_token"] || "", keycloak_token_secret);
  if (!access_token) {
    return res.status(200).json({ message: "Access Token absent. Please log in again." });
  }
  const userInfoRes = await fetch(userInfoEndpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  console.log("userInfoRes", userInfoRes);
  if (userInfoRes.status !== 200) {
    return res.status(200).json({ message: "Session expired. Please log in again." });
  }
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
