import { Prisma } from "@prisma/client";

import { getAppFromSlug } from "@calcom/app-store/utils";
import prisma, { baseEventTypeSelect } from "@calcom/prisma";
import { SchedulingType } from "@calcom/prisma/enums";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";

import { WEBAPP_URL } from "../../../constants";
import { getBookerBaseUrlSync } from "../../../getBookerUrl/client";
import { getTeam, getOrg } from "../../repository/team";

export type TeamWithMembers = Awaited<ReturnType<typeof getTeamWithMembers>>;

export async function getTeamWithMembers(args: {
  id?: number;
  slug?: string;
  userId?: number;
  orgSlug?: string | null;
  includeTeamLogo?: boolean;
  isTeamView?: boolean;
  /**
   * If true, means that you are fetching an organization and not a team
   */
  isOrgView?: boolean;
}) {
  const { id, slug, userId, orgSlug, isTeamView, isOrgView, includeTeamLogo } = args;

  // This should improve performance saving already app data found.
  const appDataMap = new Map();
  const userSelect = Prisma.validator<Prisma.UserSelect>()({
    username: true,
    email: true,
    name: true,
    id: true,
    bio: true,
    organizationId: true,
    organization: {
      select: {
        slug: true,
      },
    },
    teams: {
      select: {
        team: {
          select: {
            slug: true,
            id: true,
          },
        },
      },
    },
    credentials: {
      select: {
        app: {
          select: {
            slug: true,
            categories: true,
          },
        },
        destinationCalendars: {
          select: {
            externalId: true,
          },
        },
      },
    },
  });
  let lookupBy;

  if (id) {
    lookupBy = { id, havingMemberWithId: userId };
  } else if (slug) {
    lookupBy = { slug, havingMemberWithId: userId };
  } else {
    throw new Error("Must provide either id or slug");
  }

  const arg = {
    lookupBy,
    forOrgWithSlug: orgSlug ?? null,
    isOrg: !!isOrgView,
    teamSelect: {
      id: true,
      name: true,
      slug: true,
      ...(!!includeTeamLogo ? { logo: true } : {}),
      bio: true,
      hideBranding: true,
      hideBookATeamMember: true,
      isPrivate: true,
      metadata: true,
      parent: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      children: {
        select: {
          name: true,
          slug: true,
        },
      },
      members: {
        select: {
          accepted: true,
          role: true,
          disableImpersonation: true,
          user: {
            select: userSelect,
          },
        },
      },
      theme: true,
      brandColor: true,
      darkBrandColor: true,
      eventTypes: {
        where: {
          hidden: false,
          schedulingType: {
            not: SchedulingType.MANAGED,
          },
        },
        select: {
          users: {
            select: userSelect,
          },
          metadata: true,
          ...baseEventTypeSelect,
        },
      },
      inviteTokens: {
        select: {
          token: true,
          expires: true,
          expiresInDays: true,
          identifier: true,
        },
      },
    },
  } as const;

  const teamOrOrg = isOrgView ? await getOrg(arg) : await getTeam(arg);

  if (!teamOrOrg) return null;

  const members = teamOrOrg.members.map((m) => {
    const { credentials, ...restUser } = m.user;
    return {
      ...restUser,
      role: m.role,
      accepted: m.accepted,
      disableImpersonation: m.disableImpersonation,
      subteams: orgSlug
        ? m.user.teams
            .filter((membership) => membership.team.id !== teamOrOrg.id)
            .map((membership) => membership.team.slug)
        : null,
      avatar: `${WEBAPP_URL}/${m.user.username}/avatar.png`,
      bookerUrl: getBookerBaseUrlSync(m.user.organization?.slug || ""),
      connectedApps: !isTeamView
        ? credentials?.map((cred) => {
            const appSlug = cred.app?.slug;
            let appData = appDataMap.get(appSlug);

            if (!appData) {
              appData = getAppFromSlug(appSlug);
              appDataMap.set(appSlug, appData);
            }

            const isCalendar = cred?.app?.categories?.includes("calendar") ?? false;
            const externalId = isCalendar ? cred.destinationCalendars?.[0]?.externalId : null;
            return {
              name: appData?.name ?? null,
              logo: appData?.logo ?? null,
              app: cred.app,
              externalId: externalId ?? null,
            };
          })
        : null,
    };
  });

  const eventTypes = teamOrOrg.eventTypes.map((eventType) => ({
    ...eventType,
    metadata: EventTypeMetaDataSchema.parse(eventType.metadata),
  }));
  // Don't leak invite tokens to the frontend
  const { inviteTokens, ...teamWithoutInviteTokens } = teamOrOrg;

  // Don't leak stripe payment ids
  const teamMetadata = teamOrOrg.metadata;
  const {
    // paymentId: _,
    // subscriptionId: __,
    // subscriptionItemId: ___,
    ...restTeamMetadata
  } = teamMetadata || {};

  return {
    ...teamWithoutInviteTokens,
    /** To prevent breaking we only return non-email attached token here, if we have one */
    inviteToken: inviteTokens.find(
      (token) =>
        token.identifier === `invite-link-for-teamId-${teamOrOrg.id}` &&
        token.expires > new Date(new Date().setHours(24))
    ),
    metadata: restTeamMetadata,
    eventTypes: !isOrgView ? eventTypes : null,
    members,
  };
}

// also returns team
export async function isTeamAdmin(userId: number, teamId: number) {
  const team = await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      accepted: true,
      OR: [{ role: "ADMIN" }, { role: "OWNER" }],
    },
    include: { team: true },
  });
  if (!team) return false;
  return team;
}

export async function isTeamOwner(userId: number, teamId: number) {
  return !!(await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      accepted: true,
      role: "OWNER",
    },
  }));
}

export async function isTeamMember(userId: number, teamId: number) {
  return !!(await prisma.membership.findFirst({
    where: {
      userId,
      teamId,
      accepted: true,
    },
  }));
}

export async function teamsOwnedByAdmin(userId: number) {
  return (
    (await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId,
            OR: [{ role: "ADMIN" }, { role: "OWNER" }],
          },
        },
      },
    })) || []
  );
}

export async function membersNotPartOfPrevAdminTeams(userId: number, teamId: number) {
  const allMembersOfNewTeam = await prisma.membership.findMany({
    where: {
      teamId,
    },
  });

  const allTeams = await teamsOwnedByAdmin(userId);
  const allTeamsIdExceptNewTeam = allTeams.filter((team) => team.id !== teamId).map((team) => team.id);

  const allMembersOfPrevTeams = await prisma.membership.findMany({
    where: {
      teamId: {
        in: allTeamsIdExceptNewTeam,
      },
    },
  });

  const newMembersNotInPrevTeams = allMembersOfNewTeam.filter(
    (newMember) => !allMembersOfPrevTeams.some((prevMember) => prevMember.userId === newMember.userId)
  );
  return newMembersNotInPrevTeams.length;
}

export async function adminTeamMembers(userId: number) {
  const allTeams = await teamsOwnedByAdmin(userId);
  const allTeamsId = allTeams.map((team) => team.id);

  const allMembers = await prisma.membership.findMany({
    where: {
      teamId: {
        in: allTeamsId,
      },
    },
  });
  // Remove duplicates using Set
  const uniqueMembers = Array.from(new Set(allMembers.map((member) => member.userId)));
  return uniqueMembers;
}

export async function checkIfUserIsPartOfPaidTeam(adminId: number, emailId: string) {
  const user = await prisma.user.findUnique({ where: { email: emailId } });
  if (user) {
    const userId = user.id;
    const memberships = await prisma.membership.findMany({
      where: {
        userId: userId,
      },
    });
    const teamIds = memberships.map((membership) => membership.teamId);
    for (const teamId of teamIds) {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
        },
      });
      // Check if the team exists and has the correct 'paidForByUserId'
      if (team && team.metadata?.paidForByUserId === adminId) {
        return true; // Return true if there's at least one paid team
      }
    }

    return false; // Return false if no paid team is found
  }
  return false;
}

export async function checkPartOfHowManyPaidTeam(userId: number, memberUserId: number) {
  const allTeams = await teamsOwnedByAdmin(userId);
  const allTeamsId = allTeams.map((team) => team.id);

  const allMembers = await prisma.membership.findMany({
    where: {
      teamId: {
        in: allTeamsId,
      },
      userId: memberUserId,
    },
  });
  return allMembers.length;
}

export async function userHasPaidTeam(userId: number) {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
          OR: [{ role: "ADMIN" }, { role: "OWNER" }],
        },
      },
    },
    select: { metadata: true },
  });
  console.log(teams);
  const hasTeamWithActiveSubscription = teams.some((team) => team.metadata?.subscriptionStatus === "active");

  return hasTeamWithActiveSubscription;
}
