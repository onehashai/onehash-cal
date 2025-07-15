import type { TFunction } from "next-i18next";

import { TimeFormat } from "@calcom/lib/timeFormat";
import type { WorkflowTemplates } from "@calcom/prisma/enums";
import { WorkflowActions, WorkflowTriggerEvents } from "@calcom/prisma/enums";

import { whatsappEventCancelledTemplate } from "../templates/whatsapp/cancelled";
import { whatsappEventCompletedTemplate } from "../templates/whatsapp/completed";
import { whatsappReminderTemplate } from "../templates/whatsapp/reminder";
import { whatsappEventRescheduledTemplate } from "../templates/whatsapp/rescheduled";
import {
  ATTENDEE_WORKFLOW_TEMPLATES,
  BASIC_WORKFLOW_TEMPLATES,
  DYNAMIC_TEXT_VARIABLES,
  FORMATTED_DYNAMIC_TEXT_VARIABLES,
  TIME_UNITS,
  WHATSAPP_WORKFLOW_TEMPLATES,
  WORKFLOW_TRIGGER_EVENTS,
} from "./constants";

function validateSenderIdFormat(str: string): boolean {
  return str.length <= 11 && /^[A-Za-z0-9\s]*$/.test(str);
}

function isSmsAction(action: WorkflowActions): boolean {
  return action === WorkflowActions.SMS_ATTENDEE || action === WorkflowActions.SMS_NUMBER;
}

function isWhatsappAction(action: WorkflowActions): boolean {
  return action === WorkflowActions.WHATSAPP_NUMBER || action === WorkflowActions.WHATSAPP_ATTENDEE;
}

function isSmsOrWhatsappAction(action: WorkflowActions): boolean {
  return isSmsAction(action) || isWhatsappAction(action);
}

function isAttendeeAction(action: WorkflowActions): boolean {
  return (
    action === WorkflowActions.SMS_ATTENDEE ||
    action === WorkflowActions.EMAIL_ATTENDEE ||
    action === WorkflowActions.WHATSAPP_ATTENDEE
  );
}

const isEmailToAttendeeAction = (actionType: WorkflowActions): boolean => {
  return actionType === WorkflowActions.EMAIL_ATTENDEE;
};

function getTimeFormatFromUserSetting(timeFormat: number | null | undefined): TimeFormat {
  return timeFormat === 24 ? TimeFormat.TWENTY_FOUR_HOUR : TimeFormat.TWELVE_HOUR;
}

const determineWhatsappTemplateHandler = (
  templateCategory?: WorkflowTemplates
): typeof whatsappReminderTemplate => {
  const templateHandlerRegistry = {
    CANCELLED: whatsappEventCancelledTemplate,
    COMPLETED: whatsappEventCompletedTemplate,
    RESCHEDULED: whatsappEventRescheduledTemplate,
    CUSTOM: whatsappReminderTemplate,
    REMINDER: whatsappReminderTemplate,
  };

  return (
    templateHandlerRegistry[templateCategory as keyof typeof templateHandlerRegistry] ||
    whatsappReminderTemplate
  );
};

function getWhatsappTemplateContent(
  actionType: WorkflowActions,
  localeString: string,
  templateType: WorkflowTemplates,
  timeFormatSetting: TimeFormat
): string | null {
  const contentRenderer = determineWhatsappTemplateHandler(templateType);
  return contentRenderer(true, localeString, actionType, timeFormatSetting);
}

function translateTextVariables(text: string, language: { locale: string; t: TFunction }): string {
  let processedContent = text;

  if (language.locale !== "en") {
    const detectedVariables = text.match(/\{(.+?)}/g)?.map((variable) => {
      return variable.replace("{", "").replace("}", "");
    });

    detectedVariables?.forEach((variable) => {
      const substitutionPattern = new RegExp(`{${variable}}`, "g");
      let convertedVariable = DYNAMIC_TEXT_VARIABLES.includes(variable.toLowerCase())
        ? language.t(variable.toLowerCase().concat("_variable")).replace(/ /g, "_").toLocaleUpperCase()
        : DYNAMIC_TEXT_VARIABLES.includes(variable.toLowerCase().concat("_name"))
        ? language.t(variable.toLowerCase().concat("_name_variable")).replace(/ /g, "_").toLocaleUpperCase()
        : variable;

      const matchingFormattedVariable = FORMATTED_DYNAMIC_TEXT_VARIABLES.find((formattedVar) =>
        variable.toLowerCase().startsWith(formattedVar)
      );

      if (matchingFormattedVariable) {
        const baseVariableName = matchingFormattedVariable
          .substring(0, matchingFormattedVariable?.lastIndexOf("_"))
          .toLowerCase()
          .concat("_variable");

        convertedVariable = language
          .t(baseVariableName)
          .replace(/ /g, "_")
          .toLocaleUpperCase()
          .concat(matchingFormattedVariable?.substring(matchingFormattedVariable?.lastIndexOf("_")));
      }

      processedContent = processedContent.replace(substitutionPattern, `{${convertedVariable}}`);
    });
  }

  return processedContent;
}

function translateVariablesToEnglish(text: string, language: { locale: string; t: TFunction }): string {
  let modifiedText = text;

  if (language.locale !== "en") {
    const extractedVariables = text.match(/\{(.+?)}/g)?.map((variable) => {
      return variable.replace("{", "").replace("}", "");
    });

    extractedVariables?.forEach((variable) => {
      DYNAMIC_TEXT_VARIABLES.forEach((baseVar) => {
        const sanitizedVariableName = variable.replace("_NAME", "");
        const referenceVariable = `${baseVar}_variable`;
        if (
          language.t(referenceVariable).replace(/ /g, "_").toUpperCase() === variable ||
          language.t(referenceVariable).replace(/ /g, "_").toUpperCase() === sanitizedVariableName
        ) {
          modifiedText = modifiedText.replace(
            variable,
            language.t(referenceVariable, { lng: "en" }).replace(/ /g, "_").toUpperCase()
          );
          return;
        }
      });

      FORMATTED_DYNAMIC_TEXT_VARIABLES.forEach((formattedVar) => {
        const localizedVariable = language.t(`${formattedVar}variable`).replace(/ /g, "_").toUpperCase();
        if (variable.startsWith(localizedVariable)) {
          modifiedText = modifiedText.replace(localizedVariable, formattedVar.slice(0, -1).toUpperCase());
        }
      });
    });
  }

  return modifiedText;
}

function getTimeSectionText(trigger: WorkflowTriggerEvents, t: TFunction): string | null {
  const schedulingTextMapping: Partial<Record<WorkflowTriggerEvents, string>> = {
    [WorkflowTriggerEvents.AFTER_EVENT]: "how_long_after",
    [WorkflowTriggerEvents.BEFORE_EVENT]: "how_long_before",
    [WorkflowTriggerEvents.AFTER_HOSTS_CAL_VIDEO_NO_SHOW]: "how_long_after_hosts_no_show",
    [WorkflowTriggerEvents.AFTER_GUESTS_CAL_VIDEO_NO_SHOW]: "how_long_after_guests_no_show",
  };

  if (!schedulingTextMapping[trigger]) return null;
  return t(schedulingTextMapping[trigger]!);
}

function getWorkflowTriggerOptions(t: TFunction): Array<{
  label: string;
  value: WorkflowTriggerEvents;
}> {
  const availableTriggerEvents = WORKFLOW_TRIGGER_EVENTS.filter(
    (event) =>
      event !== WorkflowTriggerEvents.AFTER_HOSTS_CAL_VIDEO_NO_SHOW &&
      event !== WorkflowTriggerEvents.AFTER_GUESTS_CAL_VIDEO_NO_SHOW
  );

  return availableTriggerEvents.map((triggerEvent) => {
    const eventDescription = t(`${triggerEvent.toLowerCase()}_trigger`);
    return {
      label: eventDescription.charAt(0).toUpperCase() + eventDescription.slice(1),
      value: triggerEvent,
    };
  });
}

function getWorkflowTemplateOptions(
  t: TFunction,
  action: WorkflowActions | undefined
): Array<{
  label: string;
  value: WorkflowTemplates;
}> {
  const availableTemplates =
    action && isWhatsappAction(action)
      ? WHATSAPP_WORKFLOW_TEMPLATES
      : action && action === WorkflowActions.EMAIL_ATTENDEE
      ? ATTENDEE_WORKFLOW_TEMPLATES
      : BASIC_WORKFLOW_TEMPLATES;

  return availableTemplates.map((template) => ({
    label: t(`${template.toLowerCase()}`),
    value: template,
  }));
}

function getTimeUnitOptions(t: TFunction): Record<string, string> {
  return TIME_UNITS.reduce((accumulator, option) => {
    accumulator[option] = t(`${option.toLowerCase()}_timeUnit`);
    return accumulator;
  }, {} as Record<string, string>);
}

export {
  validateSenderIdFormat,
  isSmsAction,
  isWhatsappAction,
  isSmsOrWhatsappAction,
  isAttendeeAction,
  isEmailToAttendeeAction,
  getTimeFormatFromUserSetting,
  getWhatsappTemplateContent,
  translateTextVariables,
  translateVariablesToEnglish,
  getTimeSectionText,
  getWorkflowTriggerOptions,
  getWorkflowTemplateOptions,
  getTimeUnitOptions,
};
