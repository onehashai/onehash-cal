import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";

import { WEBAPP_URL, IS_PRODUCTION_BUILD } from "@calcom/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const viaSocketSecret = process.env.VIASOCKET_SECRET;
    if (!nextAuthSecret || !viaSocketSecret) {
      return res.status(500).json({ message: "Server error" });
    }

    const cookieKey = IS_PRODUCTION_BUILD ? "__Secure-next-auth.session-token" : "next-auth.session-token";
    const sessionToken = req.cookies[cookieKey];
    if (!sessionToken) {
      return res.status(400).json({ message: "Session token not found" });
    }
    const sessionCookieStr = `${cookieKey}=${sessionToken}`;

    const sessionPayload = await getToken({ req: req, secret: nextAuthSecret });
    if (!sessionPayload) {
      return res.status(400).json({ message: "Session not found" });
    }
    const embedTokenPayload = {
      org_id: "12498",
      chatbot_id: "6788a3851adb5733fc774e2a",
      user_id: sessionPayload?.id,
      variables: {
        cookie: sessionCookieStr,
        origin: WEBAPP_URL,
      },
    };
    const embedToken = jwt.sign(embedTokenPayload, viaSocketSecret);

    return res.status(200).json({ embedToken, userId: sessionPayload?.id });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
}
