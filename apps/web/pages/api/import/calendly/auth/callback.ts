import type { NextApiRequest, NextApiResponse } from "next/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query as { code: string };

  if (!code) {
    return res.status(400).json({ error: "Authorization code not provided" });
  }
  return res.send("Authorization code received");
}
