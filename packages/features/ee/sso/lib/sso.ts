import type { PrismaClient } from "@calcom/prisma";
import { TRPCError } from "@calcom/trpc/server";

import jackson from "./jackson";
import { samlProductID, tenantPrefix, samlTenantID } from "./saml";

export const ssoTenantProduct = async (prisma: PrismaClient, email: string) => {
  const { connectionController } = await jackson();

  const memberships = await prisma.membership.findMany({
    select: {
      teamId: true,
      userId: true,
    },
    where: {
      accepted: true,
      user: {
        email,
      },
    },
  });

  if (!memberships || memberships.length === 0) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "no_account_exists",
    });
  }
  const teamIds = memberships.map(({ teamId }) => teamId);

  const teams = await prisma.team.findMany({
    where: {
      id: {
        in: teamIds,
      },
    },
  });

  const activeTeams = teams.filter(
    (team) => team.metadata?.subscriptionStatus === "active" || team.metadata?.subscriptionStatus === "trial"
  );

  if (activeTeams.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Could not find a SSO Identity Provider for your email. Please contact your admin to ensure you have been given access to Cal",
    });
  }
  // Check SSO connections for each team user is a member of
  // We'll use the first one we find
  const promises = activeTeams.map(({ metadata }) =>
    connectionController.getConnections({
      tenant: metadata?.paidForByUserId ? tenantPrefix + metadata.paidForByUserId : samlTenantID,
      product: samlProductID,
    })
  );

  const connectionResults = await Promise.allSettled(promises);
  const connectionsFound = connectionResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((connections) => connections.length > 0);
  console.log(connectionsFound);

  if (connectionsFound.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Could not find a SSO Identity Provider for your email. Please contact your admin to ensure you have been given access to Cal",
    });
  }

  return {
    tenant: connectionsFound[0][0].tenant,
    product: samlProductID,
  };
};
