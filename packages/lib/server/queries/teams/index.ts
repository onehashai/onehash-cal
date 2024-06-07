import { Prisma } from "@prisma/client";

import { getAppFromSlug } from "@calcom/app-store/utils";
import prisma, { baseEventTypeSelect } from "@calcom/prisma";
import type { Team } from "@calcom/prisma/client";
import { SchedulingType } from "@calcom/prisma/enums";
import { _EventTypeModel } from "@calcom/prisma/zod";
import {
  EventTypeMetaDataSchema,
  allManagedEventTypeProps,
  unlockedManagedEventTypeProps,
} from "@calcom/prisma/zod-utils";

import { getBookerBaseUrlSync } from "../../../getBookerUrl/client";
import { getTeam, getOrg } from "../../repository/team";
import { UserRepository } from "../../repository/user";

export type TeamWithMembers = Awaited<ReturnType<typeof getTeamWithMembers>>;

export async function getTeamWithMembers(args: {
  id?: number;
  slug?: string;
  userId?: number;
  orgSlug?: string | null;
  isTeamView?: boolean;
  currentOrg?: Pick<Team, "id"> | null;
  /**
   * If true, means that you are fetching an organization and not a team
   */
  isOrgView?: boolean;
}) {
  const { id, slug, currentOrg: _currentOrg, userId, orgSlug, isTeamView, isOrgView } = args;

  // This should improve performance saving already app data found.
  const appDataMap = new Map();
  const userSelect = Prisma.validator<Prisma.UserSelect>()({
    username: true,
    email: true,
    name: true,
    avatarUrl: true,
    id: true,
    bio: true,
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
      isOrganization: true,
      logoUrl: true,
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
          isPrivate: true,
          isOrganization: true,
          logoUrl: true,
          metadata: true,
        },
      },
      parentId: true,
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
          hosts: {
            select: {
              user: {
                select: userSelect,
              },
            },
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

  const teamOrOrgMemberships = [];
  for (const membership of teamOrOrg.members) {
    teamOrOrgMemberships.push({
      ...membership,
      user: await UserRepository.enrichUserWithItsProfile({
        user: membership.user,
      }),
    });
  }
  const members = teamOrOrgMemberships.map((m) => {
    const { credentials, profile, ...restUser } = m.user;
    return {
      ...restUser,
      username: profile?.username ?? restUser.username,
      role: m.role,
      profile: profile,
      organizationId: profile?.organizationId ?? null,
      organization: profile?.organization,
      accepted: m.accepted,
      disableImpersonation: m.disableImpersonation,
      subteams: orgSlug
        ? m.user.teams
            .filter((membership) => membership.team.id !== teamOrOrg.id)
            .map((membership) => membership.team.slug)
        : null,
      bookerUrl: getBookerBaseUrlSync(profile?.organization?.slug || ""),
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

  const eventTypesWithUsersUserProfile = [];
  for (const eventType of teamOrOrg.eventTypes) {
    const usersWithUserProfile = [];
    for (const { user } of eventType.hosts) {
      usersWithUserProfile.push(
        await UserRepository.enrichUserWithItsProfile({
          user,
        })
      );
    }
    eventTypesWithUsersUserProfile.push({
      ...eventType,
      users: usersWithUserProfile,
    });
  }
  const eventTypes = eventTypesWithUsersUserProfile.map((eventType) => ({
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
    ...(teamWithoutInviteTokens.logoUrl ? { logo: teamWithoutInviteTokens.logoUrl } : {}),
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
    include: {
      team: {
        select: {
          metadata: true,
          parentId: true,
          isOrganization: true,
        },
      },
    },
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

// export async function teamsOwnedByAdmin(userId: number) {
//   return (
//     (await prisma.team.findMany({
//       where: {
//         members: {
//           some: {
//             userId,
//             OR: [{ role: "ADMIN" }, { role: "OWNER" }],
//           },
//         },
//       },
//     })) || []
//   );
// }

// export async function membersNotPartOfPrevAdminTeams(userId: number, teamId: number) {
//   const allMembersOfNewTeam = await prisma.membership.findMany({
//     where: {
//       teamId,
//     },
//   });

//   const allTeams = await teamsOwnedByAdmin(userId);
//   const allTeamsIdExceptNewTeam = allTeams.filter((team) => team.id !== teamId).map((team) => team.id);

//   const allMembersOfPrevTeams = await prisma.membership.findMany({
//     where: {
//       teamId: {
//         in: allTeamsIdExceptNewTeam,
//       },
//     },
//   });

//   const newMembersNotInPrevTeams = allMembersOfNewTeam.filter(
//     (newMember) => !allMembersOfPrevTeams.some((prevMember) => prevMember.userId === newMember.userId)
//   );
//   return newMembersNotInPrevTeams.length;
// }

// export async function adminTeamMembers(userId: number) {
//   const allTeams = await teamsOwnedByAdmin(userId);
//   const allTeamsId = allTeams.map((team) => team.id);

//   const allMembers = await prisma.membership.findMany({
//     where: {
//       teamId: {
//         in: allTeamsId,
//       },
//     },
//   });
//   // Remove duplicates using Set
//   const uniqueMembers = Array.from(new Set(allMembers.map((member) => member.userId)));
//   return uniqueMembers;
// }

// export async function checkIfUserIsPartOfPaidTeam(adminId: number, emailId: string) {
//   const user = await prisma.user.findUnique({ where: { email: emailId } });
//   if (user) {
//     const userId = user.id;
//     const memberships = await prisma.membership.findMany({
//       where: {
//         userId: userId,
//       },
//     });
//     const teamIds = memberships.map((membership) => membership.teamId);
//     for (const teamId of teamIds) {
//       const team = await prisma.team.findUnique({
//         where: {
//           id: teamId,
//         },
//       });
//       // Check if the team exists and has the correct 'paidForByUserId'
//       if (team && team.metadata?.paidForByUserId === adminId) {
//         return true; // Return true if there's at least one paid team
//       }
//     }

//     return false; // Return false if no paid team is found
//   }
//   return false;
// }

// export async function checkPartOfHowManyPaidTeam(userId: number, memberUserId: number) {
//   const allTeams = await teamsOwnedByAdmin(userId);
//   const allTeamsId = allTeams.map((team) => team.id);

//   const allMembers = await prisma.membership.findMany({
//     where: {
//       teamId: {
//         in: allTeamsId,
//       },
//       userId: memberUserId,
//     },
//   });
//   return allMembers.length;
// }

// export async function userHasPaidTeam(userId: number) {
//   const teams = await prisma.team.findMany({
//     where: {
//       members: {
//         some: {
//           userId,
//           OR: [{ role: "ADMIN" }, { role: "OWNER" }],
//         },
//       },
//     },
//     select: { metadata: true },
//   });
//   const hasTeamWithActiveSubscription = teams.some((team) => team.metadata?.subscriptionStatus === "active");

//   return hasTeamWithActiveSubscription;
// }

// export async function userHasActiveTeam(userId: number) {
//   const teams = await prisma.team.findMany({
//     where: {
//       members: {
//         some: {
//           userId,
//           OR: [{ role: "ADMIN" }, { role: "OWNER" }],
//         },
//       },
//     },
//     select: { metadata: true },
//   });
//   const hasActiveTeam = teams.some(
//     (team) => team.metadata?.subscriptionStatus === "active" || team.metadata?.subscriptionStatus === "trial"
//   );

//   return hasActiveTeam;
// }

export async function updateNewTeamMemberEventTypes(userId: number, teamId: number) {
  const eventTypesToAdd = await prisma.eventType.findMany({
    where: {
      team: { id: teamId },
      assignAllTeamMembers: true,
    },
    select: {
      ...allManagedEventTypeProps,
      id: true,
      schedulingType: true,
    },
  });

  const allManagedEventTypePropsZod = _EventTypeModel.pick(allManagedEventTypeProps);

  eventTypesToAdd.length > 0 &&
    (await prisma.$transaction(
      eventTypesToAdd.map((eventType) => {
        if (eventType.schedulingType === "MANAGED") {
          const managedEventTypeValues = allManagedEventTypePropsZod
            .omit(unlockedManagedEventTypeProps)
            .parse(eventType);

          // Define the values for unlocked properties to use on creation, not updation
          const unlockedEventTypeValues = allManagedEventTypePropsZod
            .pick(unlockedManagedEventTypeProps)
            .parse(eventType);

          // Calculate if there are new workflows for which assigned members will get too
          const currentWorkflowIds = eventType.workflows?.map((wf) => wf.workflowId);

          return prisma.eventType.create({
            data: {
              ...managedEventTypeValues,
              ...unlockedEventTypeValues,
              bookingLimits:
                (managedEventTypeValues.bookingLimits as unknown as Prisma.InputJsonObject) ?? undefined,
              recurringEvent:
                (managedEventTypeValues.recurringEvent as unknown as Prisma.InputJsonValue) ?? undefined,
              metadata: (managedEventTypeValues.metadata as Prisma.InputJsonValue) ?? undefined,
              bookingFields: (managedEventTypeValues.bookingFields as Prisma.InputJsonValue) ?? undefined,
              durationLimits: (managedEventTypeValues.durationLimits as Prisma.InputJsonValue) ?? undefined,
              onlyShowFirstAvailableSlot: managedEventTypeValues.onlyShowFirstAvailableSlot ?? false,
              userId,
              users: {
                connect: [{ id: userId }],
              },
              parentId: eventType.parentId,
              hidden: false,
              workflows: currentWorkflowIds && {
                create: currentWorkflowIds.map((wfId) => ({ workflowId: wfId })),
              },
            },
          });
        } else {
          return prisma.eventType.update({
            where: { id: eventType.id },
            data: { hosts: { create: [{ userId, isFixed: eventType.schedulingType === "COLLECTIVE" }] } },
          });
        }
      })
    ));
}
