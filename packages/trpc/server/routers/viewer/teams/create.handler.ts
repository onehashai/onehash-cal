import { startTrialCheckoutSession } from "@calcom/features/ee/teams/lib/payments";
import { WEBAPP_URL, IS_TEAM_BILLING_ENABLED } from "@calcom/lib/constants";
import { userHasPaidTeam } from "@calcom/lib/server/queries";
import { closeComUpsertTeamUser } from "@calcom/lib/sync/SyncServiceManager";
import { prisma } from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TCreateInputSchema } from "./create.schema";

type CreateOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TCreateInputSchema;
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

const generateTrialCheckoutSession = async ({
  teamSlug,
  teamName,
  userId,
}: {
  teamSlug: string;
  teamName: string;
  userId: number;
}) => {
  if (!IS_TEAM_BILLING_ENABLED) {
    console.info("Team billing is disabled, not generating a checkout session.");
    return;
  }

  const checkoutSession = await startTrialCheckoutSession({
    teamSlug,
    teamName,
    userId,
  });

  if (!checkoutSession.url)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed retrieving a checkout session URL.",
    });
  return { url: checkoutSession.url, message: "Subscribe to Trial Plan to publish Team" };
};

export const createHandler = async ({ ctx, input }: CreateOptions) => {
  const { user } = ctx;
  const { slug, name, logo } = input;
  const isOrgChildTeam = !!user.organizationId;

  // For orgs we want to create teams under the org
  if (user.organizationId && !user.organization.isOrgAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "org_admins_can_create_new_teams" });
  }

  const slugCollisions = await prisma.team.findFirst({
    where: {
      slug: slug,
      // If this is under an org, check that the team doesn't already exist
      parentId: isOrgChildTeam ? user.organizationId : null,
    },
  });

  if (slugCollisions) throw new TRPCError({ code: "BAD_REQUEST", message: "team_url_taken" });

  if (user.organizationId) {
    const nameCollisions = await prisma.user.findFirst({
      where: {
        organizationId: user.organization.id,
        username: slug,
      },
    });

    if (nameCollisions) throw new TRPCError({ code: "BAD_REQUEST", message: "team_slug_exists_as_user" });
  }

  const isUserUnderTrial = await checkIfUserUnderTrial(ctx.user.id);
  const isPaidUser = await userHasPaidTeam(ctx.user.id);
  // If the user is not a part of an org, then make them pay before creating the team
  if (!isOrgChildTeam) {
    if (ctx.user.trialEndsAt === null) {
      const checkoutSession = await generateTrialCheckoutSession({
        teamSlug: slug,
        teamName: name,
        userId: user.id,
      });

      // If there is a checkout session, return it. Otherwise, it means it's disabled.
      if (checkoutSession)
        return {
          url: checkoutSession.url,
          message: checkoutSession.message,
          team: null,
        };
    } else {
      if (!isUserUnderTrial && !isPaidUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "To continue, kindly commence your subscription via the Billing Page, as your trial period has concluded.",
        });
      }
    }
  }

  const createdTeam = await prisma.team.create({
    data: {
      slug,
      name,
      logo,
      members: {
        create: {
          userId: ctx.user.id,
          role: MembershipRole.OWNER,
          accepted: true,
        },
      },
      metadata: {
        paidForByUserId: ctx.user.id,
        subscriptionStatus: isUserUnderTrial ? "trial" : "active",
      },
      ...(isOrgChildTeam && { parentId: user.organizationId }),
    },
  });

  // Sync Services: Close.com
  closeComUpsertTeamUser(createdTeam, ctx.user, MembershipRole.OWNER);

  return {
    url: `${WEBAPP_URL}/settings/teams/${createdTeam.id}/onboard-members`,
    message: "Team Created",
    team: createdTeam,
  };
};

export default createHandler;
