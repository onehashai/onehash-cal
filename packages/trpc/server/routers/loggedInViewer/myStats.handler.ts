import type { Session } from "next-auth";

import prisma from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

type MyStatsOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    session: Session;
  };
};

const INTEGRATION_TYPES = ["razorpay_payment", "zoom_video"];

export const myStatsHandler = async ({ ctx }: MyStatsOptions) => {
  const { user: sessionUser } = ctx;

  const additionalUserInfo = await prisma.user.findFirst({
    where: {
      id: sessionUser.id,
    },
    select: {
      _count: {
        select: {
          bookings: true,
          selectedCalendars: true,
          teams: true,
          eventTypes: true,
        },
      },
      teams: {
        select: {
          team: {
            select: {
              eventTypes: { select: { id: true } },
              credentials: {
                select: { type: true },
                where: { type: { in: INTEGRATION_TYPES } },
              },
              bannerUrl: true,
              workflows: { select: { id: true } },
            },
          },
        },
      },
      schedules: { select: { id: true } },
      credentials: {
        select: { type: true },
        where: { type: { in: INTEGRATION_TYPES } },
      },
      bannerUrl: true,
      workflows: { select: { id: true } },
    },
  });

  if (!additionalUserInfo) {
    // Handle case where user is not found
    return {
      id: sessionUser.id,
      sumOfBookings: 0,
      sumOfCalendars: 0,
      sumOfTeams: 0,
      sumOfEventTypes: 0,
      sumOfTeamEventTypes: 0,
      availability_configured: false,
      integrations_connected: { razorpay_payment: false, zoom_video: false },
      branding_configured: false,
      workflows_configured: false,
      setup_items_completed: 0,
    };
  }

  // Pre-calculate values to avoid repeated calculations
  const userCredentialTypes = new Set(additionalUserInfo.credentials.map((cred) => cred.type));
  const teamCredentialTypes = new Set(
    additionalUserInfo.teams.flatMap((team) => team.team.credentials.map((cred) => cred.type))
  );

  const hasUserBanner = Boolean(additionalUserInfo.bannerUrl);
  const hasTeamBanner = additionalUserInfo.teams.some((team) => team.team.bannerUrl);

  const hasUserWorkflows = additionalUserInfo.workflows.length > 0;
  const hasTeamWorkflows = additionalUserInfo.teams.some((team) => team.team.workflows.length > 0);

  // Calculate derived values
  const sumOfTeamEventTypes = additionalUserInfo.teams.reduce(
    (sum, team) => sum + team.team.eventTypes.length,
    0
  );

  const availability_configured = additionalUserInfo.schedules.length > 0;

  const integrations_connected = {
    razorpay_payment:
      userCredentialTypes.has("razorpay_payment") || teamCredentialTypes.has("razorpay_payment"),
    zoom_video: userCredentialTypes.has("zoom_video") || teamCredentialTypes.has("zoom_video"),
  };

  const branding_configured = hasUserBanner || hasTeamBanner;
  const workflows_configured = hasUserWorkflows || hasTeamWorkflows;

  // Count setup items completed
  const setupItems = [
    availability_configured,
    integrations_connected.razorpay_payment || integrations_connected.zoom_video,
    branding_configured,
    workflows_configured,
  ];
  const setup_items_completed = setupItems.filter(Boolean).length;

  return {
    id: sessionUser.id,
    sumOfBookings: additionalUserInfo._count.bookings,
    sumOfCalendars: additionalUserInfo._count.selectedCalendars,
    sumOfTeams: additionalUserInfo._count.teams,
    sumOfEventTypes: additionalUserInfo._count.eventTypes,
    sumOfTeamEventTypes,
    availability_configured,
    integrations_connected,
    branding_configured,
    workflows_configured,
    setup_items_completed,
  };
};
