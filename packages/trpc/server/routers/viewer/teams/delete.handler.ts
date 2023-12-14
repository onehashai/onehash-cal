//On merge conflict always use the present changes
import { subdomainSuffix } from "@calcom/ee/organizations/lib/orgDomains";
import { updateTrialSubscription } from "@calcom/ee/teams/lib/payments";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { IS_TEAM_BILLING_ENABLED } from "@calcom/lib/constants";
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

const deleteVercelDomain = async ({
  slug,
  isOrganization,
}: {
  slug?: string | null;
  isOrganization?: boolean | null;
}) => {
  if (!isOrganization || !slug) {
    return false;
  }

  const fullDomain = `${slug}.${subdomainSuffix()}`;
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${fullDomain}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN_VERCEL}`,
      },
      method: "DELETE",
    }
  );

  const data = await response.json();

  // Domain is already owned by another team but you can request delegation to access it
  if (data.error?.code === "forbidden")
    throw new TRPCError({ code: "CONFLICT", message: "domain_taken_team" });

  // Domain is already being used by a different project
  if (data.error?.code === "domain_taken")
    throw new TRPCError({ code: "CONFLICT", message: "domain_taken_project" });

  return true;
};

export const deleteHandler = async ({ ctx, input }: DeleteOptions) => {
  if (!(await isTeamOwner(ctx.user?.id, input.teamId))) throw new TRPCError({ code: "UNAUTHORIZED" });

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

  if (IS_PRODUCTION)
    deleteVercelDomain({
      slug: deletedTeam.slug,
      isOrganization: deletedTeamMetadata?.isOrganization,
    });

  const isUserUnderTrial = await checkIfUserUnderTrial(ctx.user.id);
  if (isUserUnderTrial) {
    const remainingSeats = await adminTeamMembers(ctx.user.id);
    if (IS_TEAM_BILLING_ENABLED) await updateTrialSubscription(ctx.user.id, remainingSeats.length);
  } else {
    //Todo
    const totalSeats = await adminTeamMembers(ctx.user.id);
    if (totalSeats.length !== 0) {
      // await updatePaidSubscription(ctx.user.id, totalSeats.length);
    }
  }

  // Sync Services: Close.cm
  closeComDeleteTeam(deletedTeam);
};
