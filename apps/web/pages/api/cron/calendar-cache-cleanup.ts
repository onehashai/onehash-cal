import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const deleted = await prisma.calendarCache.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(Date.now()),
      },
    },
  });

  res.json({ ok: true, count: deleted.count });
}
