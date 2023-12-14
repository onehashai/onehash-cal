//On merge conflict always use the present changes
import type { Prisma } from "@prisma/client";

import { getRequestedSlugError } from "@calcom/app-store/stripepayment/lib/team-billing";
import {
  purchaseTrialSubscription,
  purchasePaidSubscription,
  updateTrialSubscription,
} from "@calcom/features/ee/teams/lib/payments";
import { IS_TEAM_BILLING_ENABLED, WEBAPP_URL } from "@calcom/lib/constants";
import { isOrganisationAdmin } from "@calcom/lib/server/queries/organisations";
import {
  isTeamAdmin,
  membersNotPartOfPrevAdminTeams,
  adminTeamMembers,
} from "@calcom/lib/server/queries/teams";
import { prisma } from "@calcom/prisma";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TPublishInputSchema } from "./publish.schema";

type PublishOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TPublishInputSchema;
};

export const parseTeamMetadataOrThrow = (metadata: Prisma.JsonValue) => {
  const parsedMetadata = teamMetadataSchema.safeParse(metadata);

  if (!parsedMetadata.success || !parsedMetadata.data)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid team metadata" });
  return parsedMetadata.data;
};

// const parseUserMetadataOrThrow = (metadata: Prisma.JsonValue) => {
//   const parsedMetadata = userMetadata.safeParse(metadata);

//   if (!parsedMetadata.success || !parsedMetadata.data)
//     throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid user metadata" });
//   return parsedMetadata.data;
// };

const generateTrialCheckoutSession = async ({ seats, userId }: { seats: number; userId: number }) => {
  if (!IS_TEAM_BILLING_ENABLED) return;

  const checkoutSession = await purchaseTrialSubscription({
    seats,
    userId,
  });
  if (!checkoutSession.url)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed retrieving a checkout session URL.",
    });
  return { url: checkoutSession.url, message: "Payment required to publish team" };
};

export const generatePaidCheckoutSession = async ({ seats, userId }: { seats: number; userId: number }) => {
  if (!IS_TEAM_BILLING_ENABLED) return;

  const checkoutSession = await purchasePaidSubscription({
    seats,
    userId,
  });
  if (!checkoutSession.url)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed retrieving a checkout session URL.",
    });
  return { url: checkoutSession.url, message: "Payment required to publish team" };
};

export const checkIfUserUnderTrial = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trialEndsAt: true },
  });
  if (user) {
    const trialEndDate = user.trialEndsAt;
    if (trialEndDate && new Date(trialEndDate) > new Date()) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

export const checkForNewMembers = async (userId: number, teamId: number) => {
  return await membersNotPartOfPrevAdminTeams(userId, teamId);
};

const publishOrganizationTeamHandler = async ({ ctx, input }: PublishOptions) => {
  if (!ctx.user.organizationId) throw new TRPCError({ code: "UNAUTHORIZED" });

  if (!isOrganisationAdmin(ctx.user.id, ctx.user?.organizationId))
    throw new TRPCError({ code: "UNAUTHORIZED" });

  const createdTeam = await prisma.team.findFirst({
    where: { id: input.teamId, parentId: ctx.user.organizationId },
    include: {
      parent: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!createdTeam || !createdTeam.parentId)
    throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

  const metadata = parseTeamMetadataOrThrow(createdTeam.metadata);

  // We update the quantity of the parent ID (organization) subscription
  if (IS_TEAM_BILLING_ENABLED) {
    // await updateQuantitySubscriptionFromStripe(createdTeam.parentId);
  }

  if (!metadata?.requestedSlug) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Can't publish team without `requestedSlug`" });
  }
  const { requestedSlug, ...newMetadata } = metadata;
  let updatedTeam: Awaited<ReturnType<typeof prisma.team.update>>;

  try {
    updatedTeam = await prisma.team.update({
      where: { id: createdTeam.id },
      data: {
        slug: requestedSlug,
        metadata: { ...newMetadata },
      },
    });
  } catch (error) {
    const { message } = getRequestedSlugError(error, requestedSlug);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  }

  return {
    url: `${WEBAPP_URL}/settings/teams/${updatedTeam.id}/profile`,
    message: "Team published successfully",
  };
};

export const publishHandler = async ({ ctx, input }: PublishOptions) => {
  if (ctx.user.organizationId) return publishOrganizationTeamHandler({ ctx, input });

  if (!(await isTeamAdmin(ctx.user.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });

  const { teamId: id } = input;
  const prevTeam = await prisma.team.findFirst({ where: { id }, include: { members: true } });
  // const allAdminTeams = await teamsOwnedByAdmin(ctx.user.id);
  if (!prevTeam) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
  const teamMetadata = parseTeamMetadataOrThrow(prevTeam.metadata);
  // const userMetadata = parseUserMetadataOrThrow(ctx.user.metadata);
  const isUserUnderTrial = await checkIfUserUnderTrial(ctx.user.id);

  if (!teamMetadata?.requestedSlug) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Can't publish team without `requestedSlug`" });
  }
  if (ctx.user.trialEndsAt === null) {
    const allSeats = await adminTeamMembers(ctx.user.id);
    const checkoutSession = await generateTrialCheckoutSession({
      seats: allSeats.length,
      userId: ctx.user.id,
    });

    if (checkoutSession) return checkoutSession;
  } else {
    if (isUserUnderTrial) {
      const newSeats = await adminTeamMembers(ctx.user.id);
      const requestedSlug = teamMetadata.requestedSlug;
      await prisma.team.update({
        where: { id },
        data: {
          slug: requestedSlug,
          metadata: {
            paidForByUserId: ctx.user.id,
            subscriptionStatus: "trial",
          },
        },
      });

      if (newSeats.length !== 0) {
        await updateTrialSubscription(ctx.user.id, newSeats.length);
      }
    } else {
      const requestedSlug = teamMetadata.requestedSlug;
      await prisma.team.update({
        where: { id },
        data: {
          slug: requestedSlug,
          metadata: {
            paidForByUserId: ctx.user.id,
            subscriptionStatus: "active",
          },
        },
      });
    }
  }

  // const { requestedSlug, ...newTeamMetadata } = teamMetadata;
  // try {
  //   await prisma.team.update({
  //     where: { id },
  //     data: {
  //       slug: requestedSlug,
  //       metadata: { ...newTeamMetadata },
  //     },
  //   });
  // } catch (error) {
  //   const { message } = getRequestedSlugError(error, requestedSlug);
  //   throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  // }

  // const newUserMetadata = userMetadata;

  // try {
  //   await prisma.user.update({
  //     where: { id },
  //     data: {
  //       metadata: { ...newUserMetadata },
  //     },
  //   });
  // } catch (error) {
  //   const message = "User not able to upgrade";
  //   throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
  // }

  return {
    url: `${WEBAPP_URL}/settings/my-account/profile`,
    message: "Published successfully",
  };
};
