// pages/api/auth/oauth/calendly_callback.ts
import type { NextApiRequest, NextApiResponse } from "next/types";

import { getAccessToken, getUserInfo } from "@lib/core/calendly";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query as { code: string };

  if (!code) {
    return res.status(400).json({ error: "Authorization code not provided" });
  }

  try {
    const { accessToken } = await getAccessToken(code);
    const userInfo = await getUserInfo(accessToken);

    return res.json({ accessToken, userInfo });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching access token:", error.message);
      return res.status(500).json({ error: "Internal Server Error", message: error.message });
    } else {
      console.error("Error fetching access token:", String(error));
      return res.status(500).json({ error: "Internal Server Error", message: String(error) });
    }
  }
}
