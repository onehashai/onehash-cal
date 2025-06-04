import type { WorkflowTriggerEvents } from "@prisma/client";

import type { TimeFormat } from "@calcom/lib/timeFormat";
import { WorkflowActions, WorkflowTemplates } from "@calcom/prisma/enums";

import {
  whatsappEventCancelledTemplate,
  whatsappEventCompletedTemplate,
  whatsappEventRescheduledTemplate,
  whatsappReminderTemplate,
} from "./reminders/templates/whatsapp";

export const shouldScheduleEmailReminder = (actionType: WorkflowActions): boolean => {
  const emailActions: WorkflowActions[] = [WorkflowActions.EMAIL_ATTENDEE, WorkflowActions.EMAIL_HOST];
  return emailActions.includes(actionType);
};

export const shouldScheduleSMSReminder = (actionType: WorkflowActions): boolean => {
  const smsActions = [WorkflowActions.SMS_ATTENDEE, WorkflowActions.SMS_NUMBER];
  return smsActions.some((smsAction) => smsAction === actionType);
};

export const isSMSAction = (actionType: WorkflowActions): boolean => {
  const textMessageActions: WorkflowActions[] = [WorkflowActions.SMS_ATTENDEE, WorkflowActions.SMS_NUMBER];
  return textMessageActions.indexOf(actionType) !== -1;
};

export const isWhatsappAction = (actionType: WorkflowActions): boolean => {
  const whatsappActionTypes = [WorkflowActions.WHATSAPP_NUMBER, WorkflowActions.WHATSAPP_ATTENDEE];
  return whatsappActionTypes.find((action) => action === actionType) !== undefined;
};

export const isSMSOrWhatsappAction = (actionType: WorkflowActions): boolean => {
  return isSMSAction(actionType) || isWhatsappAction(actionType);
};

export const isAttendeeAction = (actionType: WorkflowActions): boolean => {
  const attendeeTargetedActions: WorkflowActions[] = [
    WorkflowActions.SMS_ATTENDEE,
    WorkflowActions.EMAIL_ATTENDEE,
    WorkflowActions.WHATSAPP_ATTENDEE,
  ];
  return attendeeTargetedActions.includes(actionType);
};

export const isEmailToAttendeeAction = (actionType: WorkflowActions): boolean => {
  return actionType === WorkflowActions.EMAIL_ATTENDEE;
};

export const isTextMessageToSpecificNumber = (actionType?: WorkflowActions): boolean => {
  if (!actionType) return false;
  const numberTargetedActions = [WorkflowActions.SMS_NUMBER, WorkflowActions.WHATSAPP_NUMBER];
  return numberTargetedActions.some((action) => action === actionType);
};

export const getWhatsappTemplateForTrigger = (
  triggerEvent: Exclude<
    WorkflowTriggerEvents,
    "AFTER_HOSTS_CAL_VIDEO_NO_SHOW" | "AFTER_GUESTS_CAL_VIDEO_NO_SHOW"
  >
): WorkflowTemplates => {
  const triggerTemplateMap: Record<
    Exclude<WorkflowTriggerEvents, "AFTER_HOSTS_CAL_VIDEO_NO_SHOW" | "AFTER_GUESTS_CAL_VIDEO_NO_SHOW">,
    WorkflowTemplates
  > = {
    NEW_EVENT: WorkflowTemplates.REMINDER,
    BEFORE_EVENT: WorkflowTemplates.REMINDER,
    AFTER_EVENT: WorkflowTemplates.COMPLETED,
    EVENT_CANCELLED: WorkflowTemplates.CANCELLED,
    RESCHEDULE_EVENT: WorkflowTemplates.RESCHEDULED,
  };

  return triggerTemplateMap[triggerEvent] || WorkflowTemplates.REMINDER;
};

export const getWhatsappTemplateFunction = (
  templateType?: WorkflowTemplates
): typeof whatsappReminderTemplate => {
  const templateFunctionMap = {
    CANCELLED: whatsappEventCancelledTemplate,
    COMPLETED: whatsappEventCompletedTemplate,
    RESCHEDULED: whatsappEventRescheduledTemplate,
    CUSTOM: whatsappReminderTemplate,
    REMINDER: whatsappReminderTemplate,
  };

  return templateFunctionMap[templateType as keyof typeof templateFunctionMap] || whatsappReminderTemplate;
};

export const getWhatsappTemplateForAction = (
  actionType: WorkflowActions,
  localeString: string,
  templateType: WorkflowTemplates,
  timeFormatSetting: TimeFormat
): string | null => {
  const templateRenderer = getWhatsappTemplateFunction(templateType);
  return templateRenderer(true, localeString, actionType, timeFormatSetting);
};
