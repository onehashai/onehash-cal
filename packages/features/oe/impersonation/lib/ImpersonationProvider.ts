import type { User } from "@prisma/client";
import type { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { getSession } from "@calcom/features/auth/lib/getSession";
import { ensureOrganizationIsReviewed } from "@calcom/features/ee/organizations/lib/ensureOrganizationIsReviewed";
import { ProfileRepository } from "@calcom/lib/server/repository/profile";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import type { Membership } from "@calcom/prisma/client";
import type { OrgProfile, PersonalProfile, UserAsPersonalProfile } from "@calcom/types/UserProfile";

const teamIdentifierValidation = z.object({
  teamId: z.preprocess((val) => parseInt(z.string().parse(val), 10), z.number().positive()),
});

type UserProfileUnion =
  | UserAsPersonalProfile
  | PersonalProfile
  | (Omit<OrgProfile, "organization"> & {
      organization: OrgProfile["organization"] & {
        members: Membership[];
      };
    });

const logImpersonationAndBuildUserData = async (
  masqueradeTarget: Pick<User, "id" | "username" | "email" | "name" | "role" | "locale"> & {
    organizationId: number | null;
    profile: UserProfileUnion;
  },
  masqueradeInitiatorId: number,
  isPartOfTeam?: boolean,
  revertingToOriginal?: boolean
) => {
  await prisma.impersonations.create({
    data: {
      impersonatedBy: {
        connect: {
          id: masqueradeInitiatorId,
        },
      },
      impersonatedUser: {
        connect: {
          id: masqueradeTarget.id,
        },
      },
    },
  });

  const baseUserObject = {
    id: masqueradeTarget.id,
    username: masqueradeTarget.username,
    email: masqueradeTarget.email,
    name: masqueradeTarget.name,
    role: masqueradeTarget.role,
    belongsToActiveTeam: isPartOfTeam,
    organizationId: masqueradeTarget.organizationId,
    locale: masqueradeTarget.locale,
    profile: masqueradeTarget.profile,
  };

  if (revertingToOriginal) {
    return baseUserObject;
  }

  const originalUser = await prisma.user.findUnique({
    where: {
      id: masqueradeInitiatorId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!originalUser) throw new Error("This user does not exist.");

  return {
    ...baseUserObject,
    impersonatedBy: {
      id: originalUser.id,
      role: originalUser.role,
    },
  };
};

type AuthCredentials = Record<"username" | "teamId" | "returnToId", string> | undefined;

export function parseTeamId(credentials: Partial<AuthCredentials>) {
  return credentials?.teamId
    ? teamIdentifierValidation.parse({ teamId: credentials.teamId }).teamId
    : undefined;
}

export function checkSelfImpersonation(userSession: Session | null, credentials: Partial<AuthCredentials>) {
  if (
    userSession?.user.username === credentials?.username ||
    userSession?.user.email === credentials?.username
  ) {
    throw new Error("You cannot impersonate yourself.");
  }
}

export function checkUserIdentifier(credentials: Partial<AuthCredentials>) {
  if (!credentials?.username) {
    if (credentials?.returnToId) return;
    throw new Error("User identifier must be present");
  }
}

export function checkGlobalPermission(userSession: Session | null) {
  if (
    (userSession?.user.role !== "ADMIN" && process.env.NEXT_PUBLIC_TEAM_IMPERSONATION === "false") ||
    !userSession?.user
  ) {
    throw new Error("You do not have permission to do this.");
  }
}

async function retrieveTargetUser({
  userSession,
  targetTeamId,
  credentials,
}: {
  userSession: Session | null;
  targetTeamId: number | undefined;
  credentials: AuthCredentials | null;
}) {
  let membershipFilter: Prisma.MembershipWhereInput = {
    disableImpersonation: false,
    accepted: true,
    team: {
      id: targetTeamId,
    },
  };

  if (
    userSession?.user.org?.id &&
    userSession.user.org.id !== targetTeamId &&
    userSession?.user.role !== "ADMIN"
  ) {
    membershipFilter = {
      disableImpersonation: false,
      accepted: true,
      team: {
        id: userSession.user.org.id,
      },
    };
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: credentials?.username }, { email: credentials?.username }],
    },
    select: {
      id: true,
      username: true,
      role: true,
      name: true,
      email: true,
      disableImpersonation: true,
      locale: true,
      teams: {
        where: membershipFilter,
        select: {
          teamId: true,
          disableImpersonation: true,
          role: true,
        },
      },
    },
  });

  if (!targetUser) {
    throw new Error("This user does not exist");
  }

  const userProfile = await retrieveUserProfile(targetUser);

  return {
    ...targetUser,
    organizationId: userProfile.organization?.id ?? null,
    profile: userProfile,
  };
}

async function handleRevertToOriginalUser({
  userSession,
  credentials,
}: {
  userSession: Session | null;
  credentials: AuthCredentials | null;
}) {
  const originalUserId = userSession?.user.impersonatedBy?.id;
  if (!originalUserId || !credentials?.returnToId) return;

  const revertTargetId = parseInt(credentials.returnToId, 10);

  if (originalUserId !== revertTargetId) return;

  const originalUser = await prisma.user.findUnique({
    where: {
      id: revertTargetId,
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      organizationId: true,
      locale: true,
      profiles: true,
      teams: {
        where: {
          accepted: true,
        },
        select: {
          teamId: true,
          disableImpersonation: true,
          role: true,
        },
      },
    },
  });

  if (!originalUser) return;

  const hasTeamMemberships = originalUser.teams.length >= 1;
  const originalUserProfile = await retrieveUserProfile(originalUser);

  return {
    user: {
      id: originalUser.id,
      email: originalUser.email,
      locale: originalUser.locale,
      name: originalUser.name,
      organizationId: originalUser.organizationId,
      role: originalUser.role,
      username: originalUser.username,
      profile: originalUserProfile,
    },
    impersonatedByUID: originalUserId,
    hasTeams: hasTeamMemberships,
  };
}

const ImpersonationProvider = CredentialsProvider({
  id: "impersonation-auth",
  name: "Impersonation",
  type: "credentials",
  credentials: {
    username: { type: "text" },
    teamId: { type: "text" },
    returnToId: { type: "text" },
  },
  async authorize(credentials, request) {
    const activeSession = await getSession({ req: request });
    const parsedTeamId = parseTeamId(credentials);

    checkSelfImpersonation(activeSession, credentials);
    checkUserIdentifier(credentials);

    const revertOperation = await handleRevertToOriginalUser({ userSession: activeSession, credentials });
    if (revertOperation) {
      return logImpersonationAndBuildUserData(
        revertOperation.user,
        revertOperation.impersonatedByUID,
        revertOperation.hasTeams,
        true
      );
    }

    checkGlobalPermission(activeSession);

    const targetUserData = await retrieveTargetUser({
      userSession: activeSession,
      targetTeamId: parsedTeamId,
      credentials,
    });

    if (activeSession?.user.role === "ADMIN") {
      if (targetUserData.disableImpersonation) {
        throw new Error("This user has disabled Impersonation.");
      }
      return logImpersonationAndBuildUserData(
        targetUserData,
        activeSession.user.id as number,
        targetUserData.teams.length > 0
      );
    }

    await ensureOrganizationIsReviewed(activeSession?.user.org?.id);

    if (!parsedTeamId) throw new Error("Error-teamNotFound: You do not have permission to do this.");

    const sessionUserData = await prisma.user.findUnique({
      where: {
        id: activeSession?.user.id,
      },
      include: {
        teams: {
          where: {
            AND: [
              {
                role: {
                  in: ["ADMIN", "OWNER"],
                },
              },
              {
                team: {
                  id: parsedTeamId,
                },
              },
            ],
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (sessionUserData?.teams.length === 0 || targetUserData.teams.length === 0) {
      throw new Error("Error-UserHasNoTeams: You do not have permission to do this.");
    }

    if (sessionUserData?.teams[0].role === "ADMIN" && targetUserData.teams[0].role === "OWNER") {
      throw new Error("You do not have permission to do this.");
    }

    return logImpersonationAndBuildUserData(
      targetUserData,
      activeSession?.user.id as number,
      targetUserData.teams.length > 0
    );
  },
});

export default ImpersonationProvider;

async function retrieveUserProfile(user: { id: number; username: string | null }) {
  const organizationProfiles = await ProfileRepository.findAllProfilesForUserIncludingMovedUser({
    id: user.id,
    username: user.username,
  });

  const primaryOrgProfile = organizationProfiles[0];
  const organizationMembers = primaryOrgProfile.organizationId
    ? await prisma.membership.findMany({
        where: {
          teamId: primaryOrgProfile.organizationId,
        },
      })
    : [];

  const finalProfile = !primaryOrgProfile.organization
    ? primaryOrgProfile
    : {
        ...primaryOrgProfile,
        organization: {
          ...primaryOrgProfile.organization,
          members: organizationMembers,
        },
      };

  return finalProfile;
}
