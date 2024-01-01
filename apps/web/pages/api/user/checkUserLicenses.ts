import type { NextApiRequest, NextApiResponse } from "next";

import { getSubscriptionQuatity } from "@calcom/ee/teams/lib/payments";
import { userHasPaidTeam, adminTeamMembers, checkIfUserIsPartOfPaidTeam } from "@calcom/lib/server/queries";
import prisma from "@calcom/prisma";
import { checkIfUserUnderTrial } from "@calcom/trpc/server/routers/viewer/teams/publish.handler";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { members, input } = req.body;
  console.log(members);
  const adminId = members[0].id;
  if (!adminId) throw Error("Missing adminId");
  const adminUser = await prisma.user.findUnique({
    where: {
      id: adminId,
    },
  });
  if (!adminUser) throw Error("Missing adminUser");
  const isUserUnderTrial = await checkIfUserUnderTrial(adminId);
  if (isUserUnderTrial) {
    return res.status(200).json({ message: "Can send invitation to team members" });
  }

  const isPaidUser = await userHasPaidTeam(adminId);
  console.log(isPaidUser);
  if (!isPaidUser) {
    return res.status(200).json({ message: "Cannot send invitation to team members" });
  }

  const licenses = await getSubscriptionQuatity(adminId);
  const totalSeats = await adminTeamMembers(adminId);
  if (licenses > totalSeats.length) {
    return res.status(200).json({ message: "Can send invitation to team members" });
  }

  const paidMember = await checkIfUserIsPartOfPaidTeam(adminId, input.emailOrUsername);
  if (!paidMember) {
    return res.status(200).json({ message: "Cannot send invitation to team members" });
  }

  return res.status(200).json({ message: "Can send invitation to team members" });
}
