import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const deleted = await prisma.calendarCache.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(Date.now()),
      },
    },
  });

  res.json({ ok: true, count: deleted.count });
}
