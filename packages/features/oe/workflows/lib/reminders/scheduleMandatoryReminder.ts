import type { Workflow, WorkflowsOnEventTypes, WorkflowStep } from "@prisma/client";

import type { getEventTypesFromDB } from "@calcom/features/bookings/lib/handleNewBooking";
import type { getDefaultEvent } from "@calcom/lib/defaultEvents";
import logger from "@calcom/lib/logger";
import { WorkflowTriggerEvents, TimeUnit, WorkflowActions, WorkflowTemplates } from "@calcom/prisma/enums";

import { scheduleEmailReminder } from "./managers/emailReminderManager";
import type { BookingInfo } from "./managers/smsReminderManager";

const log = logger.getSubLogger({ prefix: ["[scheduleMandatoryReminder]"] });

export type NewBookingEventType =
  | Awaited<ReturnType<typeof getDefaultEvent>>
  | Awaited<ReturnType<typeof getEventTypesFromDB>>;

export async function scheduleMandatoryReminder(
  evt: BookingInfo,
  workflows: (WorkflowsOnEventTypes & {
    workflow: Workflow & {
      steps: WorkflowStep[];
    };
  })[],
  hideBranding: boolean,
  seatReferenceUid: string | undefined
) {
  try {
    const hasExistingWorkflow = workflows.some((workflow) => {
      return (
        workflow.workflow?.trigger === WorkflowTriggerEvents.BEFORE_EVENT &&
        ((workflow.workflow.time !== null &&
          workflow.workflow.time <= 12 &&
          workflow.workflow?.timeUnit === TimeUnit.HOUR) ||
          (workflow.workflow.time !== null &&
            workflow.workflow.time <= 720 &&
            workflow.workflow?.timeUnit === TimeUnit.MINUTE)) &&
        workflow.workflow?.steps.some((step) => step?.action === WorkflowActions.EMAIL_ATTENDEE)
      );
    });

    if (!hasExistingWorkflow && evt.attendees.some((attendee) => attendee.email.includes("@gmail.com"))) {
      try {
        const filteredAttendees =
          evt.attendees?.filter((attendee) => attendee.email.includes("@gmail.com")) || [];

        //Event Reminder Email scheduled for 1 hour before the event
        await scheduleEmailReminder({
          evt,
          triggerEvent: WorkflowTriggerEvents.BEFORE_EVENT,
          action: WorkflowActions.EMAIL_ATTENDEE,
          timeSpan: {
            time: 1,
            timeUnit: TimeUnit.HOUR,
          },
          sendTo: filteredAttendees,
          template: WorkflowTemplates.REMINDER,
          hideBranding,
          seatReferenceUid,
          includeCalendarEvent: false,
          isMandatoryReminder: true,
        });
        //Thank You Email Reminder is scheduled for 5 mins after the event
        await scheduleEmailReminder({
          evt,
          triggerEvent: WorkflowTriggerEvents.AFTER_EVENT,
          action: WorkflowActions.EMAIL_ATTENDEE,
          timeSpan: {
            time: 5,
            timeUnit: TimeUnit.MINUTE,
          },
          sendTo: filteredAttendees,
          template: WorkflowTemplates.COMPLETED,
          hideBranding,
          seatReferenceUid,
          includeCalendarEvent: false,
          isMandatoryReminder: true,
        });
      } catch (error) {
        log.error("Error while scheduling mandatory reminders", JSON.stringify({ error }));
      }
    }
  } catch (error) {
    log.error("Error while scheduling mandatory reminders", JSON.stringify({ error }));
  }
}
