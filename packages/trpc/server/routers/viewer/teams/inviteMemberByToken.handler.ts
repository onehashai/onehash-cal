//On merge conflict always use the present changes
import { Prisma } from "@prisma/client";

import { updateTrialSubscription } from "@calcom/ee/teams/lib/payments";
import { IS_TEAM_BILLING_ENABLED } from "@calcom/lib/constants";
import { adminTeamMembers } from "@calcom/lib/server/queries/teams";
import { prisma } from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";
import { TRPCError } from "@calcom/trpc/server";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import type { TInviteMemberByTokenSchemaInputSchema } from "./inviteMemberByToken.schema";
import { checkIfUserUnderTrial } from "./publish.handler";

type InviteMemberByTokenOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TInviteMemberByTokenSchemaInputSchema;
};

export const inviteMemberByTokenHandler = async ({ ctx, input }: InviteMemberByTokenOptions) => {
  const { token } = input;

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      OR: [{ expiresInDays: null }, { expires: { gte: new Date() } }],
    },
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!verificationToken) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
  if (!verificationToken.teamId || !verificationToken.team)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invite token is not associated with any team",
    });

  try {
    await prisma.membership.create({
      data: {
        teamId: verificationToken.teamId,
        userId: ctx.user.id,
        role: MembershipRole.MEMBER,
        accepted: false,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This user is a member of this team / has a pending invitation.",
        });
      }
    } else throw e;
  }

  // if (IS_TEAM_BILLING_ENABLED) await updateQuantitySubscriptionFromStripe(verificationToken.teamId);
  const isUserUnderTrial = await checkIfUserUnderTrial(ctx.user.id);
  if (isUserUnderTrial) {
    const totalSeats = await adminTeamMembers(ctx.user.id);
    if (totalSeats.length !== 0) {
      if (IS_TEAM_BILLING_ENABLED) await updateTrialSubscription(ctx.user.id, totalSeats.length);
    }
  }

  return verificationToken.team.name;
};
