import type { NextApiRequest, NextApiResponse } from "next";

import { getSubscriptionQuatity } from "@calcom/features/ee/teams/lib/payments";
import { adminTeamMembers, checkIfUserIsPartOfPaidTeam } from "@calcom/lib/server/queries";
import prisma from "@calcom/prisma";
import { checkIfUserUnderTrial } from "@calcom/trpc/server/routers/viewer/teams/publish.handler";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { members, input } = req.body;
  const adminId = members[0].id;
  if (!adminId) throw Error("Missing adminId");
  const adminUser = await prisma.user.findUnique({
    where: {
      id: adminId,
    },
  });
  if (!adminUser) throw Error("Missing adminUser");
  if (adminUser.trialEndsAt === null) {
    return res.status(200).json({ message: "Make Team" });
  }
  const isUserUnderTrial = await checkIfUserUnderTrial(adminId);
  if (isUserUnderTrial) {
    return res.status(200).json({ message: "Make Team" });
  }

  // Check if the input user is in paid team and how many licenses admin has
  const licenses = await getSubscriptionQuatity(adminId);
  const totalSeats = await adminTeamMembers(adminId);
  if (licenses > totalSeats.length) {
    return res.status(200).json({ message: "Enough Licenses" });
  }
  const paidUser = await checkIfUserIsPartOfPaidTeam(adminId, input.emailOrUsername);
  if (!paidUser) {
    return res.status(200).json({ message: "Require More Licenses" });
  }
  return res.status(200).json({ message: "Enough Licenses" });
}
