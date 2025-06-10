import { WorkflowRepository } from "@calcom/lib/server/repository/workflow";
import prisma from "@calcom/prisma";

export async function deleteWorkfowRemindersOfRemovedMember(
  organization: {
    id: number;
    parentId?: number | null;
  },
  userIdentifier: number,
  isOrganizationLevel: boolean
) {
  const handleOrganizationRemoval = async () => {
    const remindersForDeletion = await prisma.workflowReminder.findMany({
      where: {
        workflowStep: {
          workflow: {
            teamId: organization.id,
          },
        },
        booking: {
          eventType: {
            userId: userIdentifier,
          },
        },
      },
      select: {
        id: true,
        referenceId: true,
        method: true,
      },
    });
    await WorkflowRepository.deleteAllWorkflowReminders(remindersForDeletion);
  };

  const handleSubteamRemoval = async () => {
    if (!organization.parentId) return;

    const workflowsToRemove = await prisma.workflow.findMany({
      where: {
        OR: [
          {
            AND: [
              {
                activeOnTeams: {
                  some: {
                    teamId: organization.id,
                  },
                },
              },
              {
                activeOnTeams: {
                  none: {
                    team: {
                      members: {
                        some: {
                          userId: userIdentifier,
                        },
                      },
                    },
                  },
                },
              },
              { isActiveOnAll: false },
            ],
          },
        ],
      },
    });

    const targetedReminders = await prisma.workflowReminder.findMany({
      where: {
        workflowStep: {
          workflowId: {
            in: workflowsToRemove?.map((workflow) => workflow.id) ?? [],
          },
        },
        booking: {
          eventType: {
            userId: userIdentifier,
          },
        },
      },
      select: {
        id: true,
        referenceId: true,
        method: true,
      },
    });
    await WorkflowRepository.deleteAllWorkflowReminders(targetedReminders);
  };

  isOrganizationLevel ? await handleOrganizationRemoval() : await handleSubteamRemoval();
}
