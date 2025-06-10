import { WorkflowActions, WorkflowTriggerEvents } from "@calcom/prisma/enums";

import type { Workflow } from "./types";

export function allowDisablingHostConfirmationEmails(workflows: Workflow[]) {
  const hasMatchingConfiguration = workflows.some((workflowEntry) => {
    const isNewEventTrigger = workflowEntry.trigger === WorkflowTriggerEvents.NEW_EVENT;
    if (!isNewEventTrigger) return false;

    const containsHostEmailAction = workflowEntry.steps.some(
      (stepConfiguration) => stepConfiguration.action === WorkflowActions.EMAIL_HOST
    );

    return containsHostEmailAction;
  });

  return Boolean(hasMatchingConfiguration);
}

export function allowDisablingAttendeeConfirmationEmails(workflows: Workflow[]) {
  const matchesRequiredCriteria = workflows.some((workflowConfiguration) => {
    if (workflowConfiguration.trigger !== WorkflowTriggerEvents.NEW_EVENT) {
      return false;
    }

    const hasAttendeeNotificationStep = workflowConfiguration.steps.some((actionStep) => {
      const isEmailAction = actionStep.action === WorkflowActions.EMAIL_ATTENDEE;
      const isSmsAction = actionStep.action === WorkflowActions.SMS_ATTENDEE;
      return isEmailAction || isSmsAction;
    });

    return hasAttendeeNotificationStep;
  });

  return Boolean(matchesRequiredCriteria);
}
