import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";

import { WEBAPP_URL } from "@calcom/lib/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const viaSocketSecret = process.env.VIASOCKET_SECRET;
    if (!nextAuthSecret || !viaSocketSecret) {
      return res.status(500).json({ message: "Server error" });
    }
    const nextAuthToken = await getToken({ req: req, secret: nextAuthSecret });

    const sessionObject = {
      "next-auth.session-token": req.cookies["next-auth.session-token"],
    };
    const sessionObjectStr = Object.entries(sessionObject)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    console.log("sessionObjectStr__", sessionObjectStr);
    const embedTokenPayload = {
      org_id: "12498",
      chatbot_id: "6788a3851adb5733fc774e2a",
      user_id: nextAuthToken?.id,
      variables: {
        cookie: sessionObjectStr,
        origin: WEBAPP_URL,
      },
    };
    const embedToken = jwt.sign(embedTokenPayload, viaSocketSecret);

    return res.status(200).json({ embedToken, userId: nextAuthToken?.id });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
}
