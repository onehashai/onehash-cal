import prisma from "@calcom/prisma";

import type { Workflow } from "./types";

export const workflowSelect = {
  id: true,
  trigger: true,
  time: true,
  timeUnit: true,
  userId: true,
  teamId: true,
  name: true,
  steps: {
    select: {
      id: true,
      action: true,
      sendTo: true,
      reminderBody: true,
      emailSubject: true,
      template: true,
      numberVerificationPending: true,
      sender: true,
      includeCalendarEvent: true,
      numberRequired: true,
      disableOnMarkNoShow: true,
    },
  },
};

async function fetchOrganizationTeamWorkflows(targetTeamId: number): Promise<Workflow[]> {
  const teamWorkflowRelations = await prisma.workflowsOnTeams.findMany({
    where: { teamId: targetTeamId },
    select: { workflow: { select: workflowSelect } },
  });

  return teamWorkflowRelations.map((relation) => relation.workflow);
}

async function fetchOrganizationUserWorkflows(targetUserId: number): Promise<Workflow[]> {
  const userWorkflowRelations = await prisma.workflowsOnTeams.findMany({
    where: {
      team: {
        members: {
          some: {
            userId: targetUserId,
            accepted: true,
          },
        },
      },
    },
    select: {
      workflow: { select: workflowSelect },
      team: true,
    },
  });

  return userWorkflowRelations.map((relation) => relation.workflow);
}

async function fetchUniversalActiveWorkflows(entityId: number): Promise<Workflow[]> {
  return prisma.workflow.findMany({
    where: {
      teamId: entityId,
      isActiveOnAll: true,
    },
    select: workflowSelect,
  });
}

async function fetchPersonalActiveWorkflows(targetUserId: number): Promise<Workflow[]> {
  return prisma.workflow.findMany({
    where: {
      userId: targetUserId,
      teamId: null,
      isActiveOnAll: true,
    },
    select: workflowSelect,
  });
}

function removeDuplicateWorkflows(workflowCollection: Workflow[]): Workflow[] {
  const processedIds = new Set<number>();

  return workflowCollection.filter((workflowItem) => {
    const isAlreadyProcessed = processedIds.has(workflowItem.id);
    processedIds.add(workflowItem.id);
    return !isAlreadyProcessed;
  });
}

export const getAllWorkflows = async (
  eventTypeWorkflows: Workflow[],
  userId?: number | null,
  teamId?: number | null,
  orgId?: number | null,
  workflowsLockedForUser = true
) => {
  const combinedWorkflows: Workflow[] = [...eventTypeWorkflows];

  if (orgId) {
    if (teamId) {
      const orgTeamWorkflows = await fetchOrganizationTeamWorkflows(teamId);
      combinedWorkflows.push(...orgTeamWorkflows);
    } else if (userId) {
      const orgUserWorkflows = await fetchOrganizationUserWorkflows(userId);
      combinedWorkflows.push(...orgUserWorkflows);
    }

    const organizationUniversalWorkflows = await fetchUniversalActiveWorkflows(orgId);
    combinedWorkflows.push(...organizationUniversalWorkflows);
  }

  if (teamId) {
    const teamUniversalWorkflows = await fetchUniversalActiveWorkflows(teamId);
    combinedWorkflows.push(...teamUniversalWorkflows);
  }

  const shouldIncludePersonalWorkflows = (!teamId || !workflowsLockedForUser) && userId;
  if (shouldIncludePersonalWorkflows) {
    const personalUniversalWorkflows = await fetchPersonalActiveWorkflows(userId);
    combinedWorkflows.push(...personalUniversalWorkflows);
  }

  return removeDuplicateWorkflows(combinedWorkflows);
};
