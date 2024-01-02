//Merge Conflict Properly in regards to OneHash Billing
import { updateTrialSubscription } from "@calcom/ee/teams/lib/payments";
import { IS_TEAM_BILLING_ENABLED } from "@calcom/lib/constants";
import { deleteDomain } from "@calcom/lib/domainManager/organization";
import { isTeamOwner } from "@calcom/lib/server/queries/teams";
import { adminTeamMembers } from "@calcom/lib/server/queries/teams";
import { closeComDeleteTeam } from "@calcom/lib/sync/SyncServiceManager";
import { prisma } from "@calcom/prisma";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TDeleteInputSchema } from "./delete.schema";
import { checkIfUserUnderTrial } from "./publish.handler";

type DeleteOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteInputSchema;
};

export const deleteHandler = async ({ ctx, input }: DeleteOptions) => {
  if (!(await isTeamOwner(ctx.user?.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });

  // const countBeforeDeletingMember = await checkPartOfHowManyPaidTeam(ctx.user.id, input.memberId);
  // delete all memberships
  await prisma.membership.deleteMany({
    where: {
      teamId: input.teamId,
    },
  });

  const deletedTeam = await prisma.team.delete({
    where: {
      id: input.teamId,
    },
  });

  const deletedTeamMetadata = teamMetadataSchema.parse(deletedTeam.metadata);

  if (deletedTeamMetadata?.isOrganization && deletedTeam.slug) deleteDomain(deletedTeam.slug);

  if (IS_TEAM_BILLING_ENABLED) {
    const isUserUnderTrial = await checkIfUserUnderTrial(ctx.user.id);
    if (isUserUnderTrial) {
      const remainingSeats = await adminTeamMembers(ctx.user.id);
      await updateTrialSubscription(ctx.user.id, remainingSeats.length);
    }
  }
  // Sync Services: Close.cm
  closeComDeleteTeam(deletedTeam);
};

export default deleteHandler;
