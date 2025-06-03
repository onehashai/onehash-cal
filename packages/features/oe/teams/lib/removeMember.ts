import logger from "@calcom/lib/logger";
import { ProfileRepository } from "@calcom/lib/server/repository/profile";
import prisma from "@calcom/prisma";

import { TRPCError } from "@trpc/server";

import { deleteWorkfowRemindersOfRemovedMember } from "./deleteWorkflowRemindersOfRemovedMember";

const loggerInstance = logger.getSubLogger({ prefix: ["removeMember"] });

const expelOrganizationMember = async ({
  memberId,
  teamId,
  isOrg,
}: {
  memberId: number;
  teamId: number;
  isOrg: boolean;
}) => {
  const [removedMembership] = await prisma.$transaction([
    prisma.membership.delete({
      where: {
        userId_teamId: { userId: memberId, teamId: teamId },
      },
      include: {
        user: true,
        team: true,
      },
    }),
    prisma.host.deleteMany({
      where: {
        userId: memberId,
        eventType: {
          teamId: teamId,
        },
      },
    }),
  ]);

  const organizationData = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      isOrganization: true,
      organizationSettings: true,
      id: true,
      metadata: true,
      activeOrgWorkflows: true,
      parentId: true,
    },
  });

  const targetUser = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      movedToProfileId: true,
      email: true,
      username: true,
      completedOnboarding: true,
      teams: {
        select: {
          team: {
            select: {
              id: true,
              parentId: true,
            },
          },
        },
      },
    },
  });

  if (!organizationData || !targetUser) throw new TRPCError({ code: "NOT_FOUND" });

  if (isOrg) {
    loggerInstance.debug("Removing a member from the organization");

    await prisma.membership.deleteMany({
      where: {
        team: {
          parentId: teamId,
        },
        userId: removedMembership.userId,
      },
    });

    const userForRemoval = targetUser;

    const userProfile = await ProfileRepository.findByUserIdAndOrgId({
      userId: userForRemoval.id,
      organizationId: organizationData.id,
    });

    if (userForRemoval.username && userForRemoval.movedToProfileId === userProfile?.id) {
      loggerInstance.debug("Cleaning up tempOrgRedirect for user", userForRemoval.username);

      await prisma.tempOrgRedirect.deleteMany({
        where: {
          from: userForRemoval.username,
        },
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: removedMembership.userId },
        data: { organizationId: null },
      }),
      ProfileRepository.delete({
        userId: removedMembership.userId,
        organizationId: organizationData.id,
      }),
      prisma.host.deleteMany({
        where: {
          userId: memberId,
          eventType: {
            team: {
              parentId: teamId,
            },
          },
        },
      }),
    ]);
  }

  await prisma.eventType.deleteMany({
    where: { parent: { teamId: teamId }, userId: removedMembership.userId },
  });

  await deleteWorkfowRemindersOfRemovedMember(organizationData, memberId, isOrg);

  return { membership: removedMembership };
};

export default expelOrganizationMember;
