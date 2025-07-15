import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  TextField,
} from "@onehash/oe-features/ui";
import { useState, useEffect, useRef } from "react";
import { Controller } from "react-hook-form";

import { SENDER_ID, SENDER_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { WorkflowActions, WorkflowTemplates } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc";
import {
  AddVariablesDropdown,
  Badge,
  Editor,
  EmailField,
  Icon,
  PhoneInput,
  showToast,
  Tooltip,
} from "@calcom/ui";

import { cn } from "../../../lib/cn";
import { DYNAMIC_TEXT_VARIABLES } from "../../config/constants";
import type { WorkflowStepComponentProps } from "../../config/types";
import {
  getTimeFormatFromUserSetting,
  getWorkflowTemplateOptions,
  isAttendeeAction,
  isSmsAction,
  isWhatsappAction,
  isSmsOrWhatsappAction,
  getWhatsappTemplateContent,
} from "../../config/utils";
import emailRatingTemplate from "../../templates/email/ratingTemplate";
import emailReminderTemplate from "../../templates/email/reminder";
import smsReminderTemplate from "../../templates/sms/reminder";
import { whatsappReminderTemplate } from "../../templates/whatsapp/reminder";

const WorkflowStepAction: React.FC<WorkflowStepComponentProps> = ({
  step,
  index,
  form,
  readOnly,
  actionOptions,
  teamId,
  userTimeFormat,
  onRemove,
}) => {
  const { t, i18n } = useLocale();

  const { data: validatedPhoneNumbers } = trpc.viewer.workflows.getVerifiedNumbers.useQuery(
    { teamId },
    { enabled: !!teamId }
  );
  const { data: confirmedEmailAddresses } = trpc.viewer.workflows.getVerifiedEmails.useQuery({ teamId });

  const [requiresSenderIdentification, setRequiresSenderIdentification] = useState(
    step?.action === WorkflowActions.SMS_NUMBER || step?.action === WorkflowActions.SMS_ATTENDEE
  );
  const [needsEmailDestination, setNeedsEmailDestination] = useState(
    step?.action === WorkflowActions.EMAIL_ADDRESS
  );
  const [subjectLineRequired, setSubjectLineRequired] = useState(
    step?.action === WorkflowActions.EMAIL_ATTENDEE ||
      step?.action === WorkflowActions.EMAIL_HOST ||
      step?.action === WorkflowActions.EMAIL_ADDRESS
  );
  const [phoneNumberInput, setPhoneNumberInput] = useState(
    WorkflowActions.SMS_NUMBER === step?.action || WorkflowActions.WHATSAPP_NUMBER === step?.action
  );
  const [attendeePhoneValidation, setAttendeePhoneValidation] = useState(
    step?.action === WorkflowActions.SMS_ATTENDEE || step?.action === WorkflowActions.WHATSAPP_ATTENDEE
  );
  const [phoneValidationStatus, setPhoneValidationStatus] = useState(false);
  const [emailValidationStatus, setEmailValidationStatus] = useState(false);
  const [templateRefreshTrigger, setTemplateRefreshTrigger] = useState(false);
  const [verificationDigits, setVerificationDigits] = useState("");
  const [helpDialogVisible, setHelpDialogVisible] = useState(false);
  const [initialRenderComplete, setInitialRenderComplete] = useState(true);

  // Use correct field path for registration
  const fieldPath = `steps.${index}` as const;

  const { ref: subjectFieldRef, ...remainingSubjectProps } = step
    ? form.register(`${fieldPath}.emailSubject`)
    : { ref: null, name: "" };
  const subjectInputRef = useRef<HTMLTextAreaElement | null>(null);

  const userTimePreference = getTimeFormatFromUserSetting(userTimeFormat);
  const validPhoneList = validatedPhoneNumbers?.map((number) => number.phoneNumber) || [];
  const validEmailList = confirmedEmailAddresses || [];
  const availableTemplates = getWorkflowTemplateOptions(t, step?.action);
  const currentTemplate = { label: t(`${step.template.toLowerCase()}`), value: step.template };

  const checkPhoneValidation = (): boolean =>
    !!step && !!validPhoneList.find((number: string) => number === form.getValues(`${fieldPath}.sendTo`));

  const checkEmailValidation = (): boolean =>
    !!step && !!validEmailList.find((email: string) => email === form.getValues(`${fieldPath}.sendTo`));

  const utilsInstance = trpc.useUtils();

  const phoneCodeMutation = trpc.viewer.workflows.sendVerificationCode.useMutation({
    onSuccess: async () => {
      showToast(t("verification_code_sent"), "success");
    },
    onError: async (error) => {
      showToast(error.message, "error");
    },
  });

  const phoneVerificationMutation = trpc.viewer.workflows.verifyPhoneNumber.useMutation({
    onSuccess: async (validationResult) => {
      showToast(validationResult ? t("verified_successfully") : t("wrong_code"), "success");
      setPhoneValidationStatus(validationResult);
      if (
        step &&
        form?.formState?.errors?.steps &&
        form.formState.errors.steps[index]?.sendTo &&
        validationResult
      ) {
        form.clearErrors(`${fieldPath}.sendTo`);
      }
      utilsInstance.viewer.workflows.getVerifiedNumbers.invalidate();
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const errorMessage = `${err.statusCode}: ${err.message}`;
        showToast(errorMessage, "error");
        setPhoneValidationStatus(false);
      }
    },
  });

  const emailCodeMutation = trpc.viewer.auth.sendVerifyEmailCode.useMutation({
    onSuccess() {
      showToast(t("email_sent"), "success");
    },
    onError: () => {
      showToast(t("email_not_sent"), "error");
    },
  });

  const emailVerificationMutation = trpc.viewer.workflows.verifyEmailCode.useMutation({
    onSuccess: (validationResult) => {
      showToast(validationResult ? t("verified_successfully") : t("wrong_code"), "success");
      setEmailValidationStatus(true);
      if (
        step &&
        form?.formState?.errors?.steps &&
        form.formState.errors.steps[index]?.sendTo &&
        validationResult
      ) {
        form.clearErrors(`${fieldPath}.sendTo`);
      }
      utilsInstance.viewer.workflows.getVerifiedEmails.invalidate();
    },
    onError: (err) => {
      if (err.message === "invalid_code") {
        showToast(t("code_provided_invalid"), "error");
        setEmailValidationStatus(false);
      }
    },
  });

  const insertVariableIntoSubject = (variableText: string): void => {
    if (step) {
      const existingSubject = subjectInputRef?.current?.value || "";
      const caretPosition = subjectInputRef?.current?.selectionStart || existingSubject.length;
      const updatedSubject = `${existingSubject.substring(0, caretPosition)}{${variableText
        .toUpperCase()
        .replace(/ /g, "_")}}${existingSubject.substring(caretPosition)}`;
      form.setValue(`${fieldPath}.emailSubject`, updatedSubject);
    }
  };

  const updateActionType = (selectedAction: WorkflowActions): void => {
    if (!selectedAction) return;

    const previousAction = form.getValues(`${fieldPath}.action`);

    const configureNumberSettings = ({
      phoneNumberIsNeeded,
      canRequirePhoneNumber = false,
      senderNeeded = true,
    }: {
      phoneNumberIsNeeded: boolean;
      canRequirePhoneNumber?: boolean;
      senderNeeded?: boolean;
    }) => {
      setRequiresSenderIdentification(senderNeeded);
      setNeedsEmailDestination(false);
      setPhoneNumberInput(phoneNumberIsNeeded);
      setPhoneValidationStatus(checkPhoneValidation());
      setAttendeePhoneValidation(canRequirePhoneNumber);
    };

    if (selectedAction === WorkflowActions.SMS_ATTENDEE || selectedAction === WorkflowActions.SMS_NUMBER) {
      configureNumberSettings({
        phoneNumberIsNeeded: selectedAction === WorkflowActions.SMS_NUMBER,
        canRequirePhoneNumber: isAttendeeAction(selectedAction),
      });

      if (!isSmsAction(previousAction)) {
        form.setValue(`${fieldPath}.reminderBody`, "");
        form.setValue(`${fieldPath}.sender`, SENDER_ID);
      }
      setSubjectLineRequired(false);
    } else if (
      selectedAction === WorkflowActions.WHATSAPP_NUMBER ||
      selectedAction === WorkflowActions.WHATSAPP_ATTENDEE
    ) {
      configureNumberSettings({
        phoneNumberIsNeeded: selectedAction === WorkflowActions.WHATSAPP_NUMBER,
        senderNeeded: false,
        canRequirePhoneNumber: isAttendeeAction(selectedAction),
      });

      if (!isWhatsappAction(previousAction)) {
        form.setValue(`${fieldPath}.reminderBody`, "");
        form.setValue(`${fieldPath}.sender`, "");
      }
      setSubjectLineRequired(false);
    } else {
      setPhoneNumberInput(false);
      setRequiresSenderIdentification(false);
      setNeedsEmailDestination(selectedAction === WorkflowActions.EMAIL_ADDRESS);
      setSubjectLineRequired(true);
      setAttendeePhoneValidation(false);
    }

    if (form.getValues(`${fieldPath}.template`) === WorkflowTemplates.REMINDER) {
      if (isSmsOrWhatsappAction(selectedAction) === isSmsOrWhatsappAction(previousAction)) {
        if (isAttendeeAction(previousAction) !== isAttendeeAction(selectedAction)) {
          const existingContent = form.getValues(`${fieldPath}.reminderBody`) || "";
          const swappedContent = existingContent
            .replaceAll("{ORGANIZER}", "{PLACEHOLDER}")
            .replaceAll("{ATTENDEE}", "{ORGANIZER}")
            .replaceAll("{PLACEHOLDER}", "{ATTENDEE}");
          form.setValue(`${fieldPath}.reminderBody`, swappedContent);

          if (!isSmsOrWhatsappAction(selectedAction)) {
            const existingSubject = form.getValues(`${fieldPath}.emailSubject`) || "";
            const updatedSubject = isAttendeeAction(selectedAction)
              ? existingSubject.replace("{ORGANIZER}", "{ATTENDEE}")
              : existingSubject.replace("{ATTENDEE}", "{ORGANIZER}");
            form.setValue(`${fieldPath}.emailSubject`, updatedSubject || "");
          }
        }
      } else {
        if (isSmsAction(selectedAction)) {
          form.setValue(
            `${fieldPath}.reminderBody`,
            smsReminderTemplate(true, i18n.language, selectedAction, userTimePreference)
          );
        } else if (isWhatsappAction(selectedAction)) {
          form.setValue(
            `${fieldPath}.reminderBody`,
            whatsappReminderTemplate(true, i18n.language, selectedAction, userTimePreference)
          );
        } else {
          const emailTemplate = emailReminderTemplate(
            true,
            i18n.language,
            selectedAction,
            userTimePreference
          );
          form.setValue(`${fieldPath}.reminderBody`, emailTemplate.emailBody);
          form.setValue(`${fieldPath}.emailSubject`, emailTemplate.emailSubject);
        }
      }
    } else {
      const templateType = isWhatsappAction(selectedAction) ? "REMINDER" : "CUSTOM";
      templateType && form.setValue(`${fieldPath}.template`, templateType);
    }

    form.unregister(`${fieldPath}.sendTo`);
    form.clearErrors(`${fieldPath}.sendTo`);
    form.setValue(`${fieldPath}.action`, selectedAction);
    setTemplateRefreshTrigger(!templateRefreshTrigger);
  };

  const updateTemplateContent = (selectedTemplate: WorkflowTemplates): void => {
    if (!selectedTemplate) return;

    const currentAction = form.getValues(`${fieldPath}.action`);

    if (selectedTemplate === WorkflowTemplates.REMINDER) {
      if (isWhatsappAction(currentAction)) {
        form.setValue(
          `${fieldPath}.reminderBody`,
          whatsappReminderTemplate(true, i18n.language, currentAction, userTimePreference)
        );
      } else if (isSmsAction(currentAction)) {
        form.setValue(
          `${fieldPath}.reminderBody`,
          smsReminderTemplate(true, i18n.language, currentAction, userTimePreference)
        );
      } else {
        const emailContent = emailReminderTemplate(true, i18n.language, currentAction, userTimePreference);
        form.setValue(`${fieldPath}.reminderBody`, emailContent.emailBody);
        form.setValue(`${fieldPath}.emailSubject`, emailContent.emailSubject);
      }
    } else if (selectedTemplate === WorkflowTemplates.RATING) {
      const ratingContent = emailRatingTemplate({
        isEditingMode: true,
        locale: i18n.language,
        action: currentAction,
        timeFormat: userTimePreference,
      });
      form.setValue(`${fieldPath}.reminderBody`, ratingContent.emailBody);
      form.setValue(`${fieldPath}.emailSubject`, ratingContent.emailSubject);
    } else {
      if (isWhatsappAction(currentAction)) {
        form.setValue(
          `${fieldPath}.reminderBody`,
          getWhatsappTemplateContent(currentAction, i18n.language, selectedTemplate, userTimePreference)
        );
      } else {
        form.setValue(`${fieldPath}.reminderBody`, "");
        form.setValue(`${fieldPath}.emailSubject`, "");
      }
    }

    form.setValue(`${fieldPath}.template`, selectedTemplate);
    setTemplateRefreshTrigger(!templateRefreshTrigger);
  };

  useEffect(() => {
    setPhoneValidationStatus(checkPhoneValidation());
    setEmailValidationStatus(checkEmailValidation());
  }, [step, validatedPhoneNumbers, confirmedEmailAddresses]);

  return (
    <div key={step.id} className="relative rounded-lg border border-gray-200 p-6">
      {!readOnly && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="absolute right-2 top-2 h-8 w-8 p-0 text-gray-400 hover:text-red-500"
          type="button">
          <Icon name="x" className="h-4 w-4" />
        </Button>
      )}
      <div className="space-y-6">
        <div className="space-y-4">
          <Label className="font-sm text-sm text-gray-900">Action {index + 1}</Label>

          <div className="space-y-3">
            <Controller
              name={`${fieldPath}.action`}
              control={form.control}
              render={({ field }) => {
                const actionLabel = t(`${step.action.toLowerCase()}_action`);
                const currentSelection = {
                  label: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1),
                  value: step.action,
                  needsTeamsUpgrade: false,
                };

                return (
                  <Select
                    value={field.value}
                    disabled={readOnly}
                    onValueChange={(val: WorkflowActions) => {
                      field.onChange(val);
                      updateActionType(val);
                    }}>
                    <SelectTrigger className="border-gray-200 text-base focus:border-gray-400 focus:ring-0">
                      <SelectValue placeholder="Choose delivery method" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-200 bg-white">
                      {actionOptions?.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          {t(`${action.value.toLowerCase()}_action`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }}
            />
          </div>

          {phoneNumberInput && (
            <div className="bg-muted mt-2 rounded-md p-4 pt-0">
              <Label className="pt-4">{t("custom_phone_number")}</Label>
              <div className="block sm:flex">
                <Controller
                  name={`${fieldPath}.sendTo`}
                  control={form.control}
                  render={({ field: { value, onChange } }) => (
                    <PhoneInput
                      placeholder={t("phone_number")}
                      id={`${fieldPath}.sendTo`}
                      className="min-w-fit sm:rounded-r-none sm:rounded-bl-md sm:rounded-tl-md"
                      required
                      disabled={readOnly}
                      value={value ?? ""}
                      onChange={(val) => {
                        const alreadyValidated = !!validPhoneList
                          ?.concat([])
                          .find((number) => number.replace(/\s/g, "") === val?.replace(/\s/g, ""));
                        setPhoneValidationStatus(alreadyValidated);
                        onChange(val);
                      }}
                    />
                  )}
                />
                <Button
                  variant="outline"
                  disabled={phoneValidationStatus || readOnly || false}
                  className={cn(
                    "-ml-[3px] h-[40px] min-w-fit sm:block sm:rounded-bl-none sm:rounded-tl-none",
                    phoneValidationStatus ? "hidden" : "mt-3 sm:mt-0"
                  )}
                  onClick={() =>
                    phoneCodeMutation.mutate({
                      phoneNumber: form.getValues(`${fieldPath}.sendTo`) || "",
                    })
                  }>
                  {t("send_code")}
                </Button>
              </div>

              {form.formState.errors.steps && form.formState?.errors?.steps[index]?.sendTo && (
                <p className="mt-1 text-xs text-red-500">
                  {form.formState?.errors?.steps[index]?.sendTo?.message || ""}
                </p>
              )}

              {phoneValidationStatus ? (
                <div className="mt-1">
                  <Badge variant="green">{t("number_verified")}</Badge>
                </div>
              ) : (
                !readOnly && (
                  <>
                    <div className="mt-3 flex">
                      <TextField
                        className="rounded-r-none border-r-transparent"
                        placeholder="Verification code"
                        disabled={readOnly}
                        value={verificationDigits}
                        onChange={(e) => setVerificationDigits(e.target.value)}
                        required
                      />
                      <Button
                        variant="outline"
                        className="-ml-[3px] h-[36px] min-w-fit py-0 sm:block sm:rounded-bl-none sm:rounded-tl-none "
                        disabled={phoneVerificationMutation.isPending || readOnly}
                        onClick={() => {
                          phoneVerificationMutation.mutate({
                            phoneNumber: form.getValues(`${fieldPath}.sendTo`) || "",
                            code: verificationDigits,
                            teamId,
                          });
                        }}>
                        {t("verify")}
                      </Button>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {!isWhatsappAction(form.getValues(`${fieldPath}.action`)) && (
            <div className="bg-muted mt-2 rounded-md p-4 pt-0">
              {requiresSenderIdentification ? (
                <>
                  <div className="pt-4">
                    <div className="flex items-center">
                      <Label>{t("sender_id")}</Label>
                      <Tooltip content={t("sender_id_info")}>
                        <span>
                          <Icon name="info" className="mb-2 ml-2 mr-1 mt-0.5 h-4 w-4 text-gray-500" />
                        </span>
                      </Tooltip>
                    </div>
                    <Input
                      type="text"
                      placeholder={SENDER_ID}
                      disabled={readOnly}
                      maxLength={11}
                      {...form.register(`${fieldPath}.sender`)}
                    />
                  </div>
                  {form.formState.errors.steps && form.formState?.errors?.steps[index]?.sender && (
                    <p className="mt-1 text-xs text-red-500">{t("sender_id_error_message")}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="pt-4">
                    <Label>{t("sender_name")}</Label>
                    <Input
                      type="text"
                      disabled={readOnly}
                      placeholder={SENDER_NAME}
                      {...form.register(`${fieldPath}.senderName`)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {attendeePhoneValidation && (
            <div className="mt-2">
              <Controller
                name={`${fieldPath}.numberRequired`}
                control={form.control}
                render={({ field: { value, onChange } }) => (
                  <div className="flex items-center gap-1">
                    <Checkbox
                      disabled={readOnly}
                      checked={value || false}
                      defaultChecked={form.getValues(`${fieldPath}.numberRequired`) || false}
                      id={`${fieldPath}.numberRequired`}
                      onCheckedChange={(e) => {
                        onChange(e);
                        form.setValue(`${fieldPath}.numberRequired`, e ? true : false);
                      }}
                    />
                    <Label htmlFor={`${fieldPath}.numberRequired`} className="ml-2 text-sm text-gray-700">
                      {t("make_phone_number_required")}
                    </Label>
                  </div>
                )}
              />
            </div>
          )}

          {needsEmailDestination && (
            <div className="bg-muted mt-5 rounded-md p-4">
              <Label>{t("email_address")}</Label>
              <div className="block sm:flex">
                <Controller
                  name={`${fieldPath}.sendTo`}
                  control={form.control}
                  render={({ field: { value, onChange } }) => (
                    <EmailField
                      required
                      containerClassName="w-full"
                      className="h-10 min-w-fit sm:rounded-r-none sm:rounded-bl-md sm:rounded-tl-md"
                      placeholder={t("email_address")}
                      value={value || ""}
                      disabled={readOnly}
                      onChange={(val) => {
                        const alreadyValidated = !!validEmailList
                          ?.concat([])
                          .find((email) => email === val.target.value);
                        setEmailValidationStatus(alreadyValidated);
                        onChange(val);
                      }}
                    />
                  )}
                />
                <Button
                  variant="outline"
                  disabled={emailValidationStatus || readOnly || false}
                  className={cn(
                    "-ml-[3px] h-[40px] min-w-fit sm:block sm:rounded-bl-none sm:rounded-tl-none",
                    emailValidationStatus ? "hidden" : "mt-3 sm:mt-0"
                  )}
                  onClick={() => {
                    const emailAddress = form.getValues(`${fieldPath}.sendTo`) || "";
                    emailCodeMutation.mutate({
                      email: emailAddress,
                      isVerifyingEmail: true,
                    });
                  }}>
                  {t("send_code")}
                </Button>
              </div>

              {form.formState.errors.steps && form.formState?.errors?.steps[index]?.sendTo && (
                <p className="mt-1 text-xs text-red-500">
                  {form.formState?.errors?.steps[index]?.sendTo?.message || ""}
                </p>
              )}

              {emailValidationStatus ? (
                <div className="mt-1">
                  <Badge variant="green">{t("email_verified")}</Badge>
                </div>
              ) : (
                !readOnly && (
                  <>
                    <div className="mt-3 flex">
                      <TextField
                        className="rounded-r-none border-r-transparent"
                        placeholder="Verification code"
                        disabled={readOnly}
                        value={verificationDigits}
                        onChange={(e) => setVerificationDigits(e.target.value)}
                        required
                      />
                      <Button
                        variant="outline"
                        className="-ml-[3px] h-[36px] min-w-fit py-0 sm:block sm:rounded-bl-none sm:rounded-tl-none "
                        disabled={emailVerificationMutation.isPending || readOnly}
                        onClick={() => {
                          emailVerificationMutation.mutate({
                            code: verificationDigits,
                            email: form.getValues(`${fieldPath}.sendTo`) || "",
                            teamId,
                          });
                        }}>
                        {t("verify")}
                      </Button>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          <div className="mt-5">
            <Label>{t("message_template")}</Label>
            <Controller
              name={`${fieldPath}.template`}
              control={form.control}
              render={({ field }) => (
                <Select
                  disabled={readOnly}
                  onValueChange={(val: WorkflowTemplates) => {
                    field.onChange(val);
                    updateTemplateContent(val);
                  }}
                  value={field.value}>
                  <SelectTrigger className="border-gray-200 text-base focus:border-gray-400 focus:ring-0">
                    <SelectValue placeholder="Choose Template" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-200 bg-white">
                    {availableTemplates?.map((template) => (
                      <SelectItem key={template.value} value={template.value}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="bg-muted mt-2 rounded-md pt-2 md:p-6 md:pt-4">
            {subjectLineRequired && (
              <div className="mb-6">
                <div className="flex items-center">
                  <Label className={cn("flex-none", readOnly ? "mb-2" : "mb-0")}>{t("email_subject")}</Label>
                  {!readOnly && (
                    <div className="flex-grow text-right">
                      <AddVariablesDropdown
                        addVariable={insertVariableIntoSubject}
                        variables={DYNAMIC_TEXT_VARIABLES}
                      />
                    </div>
                  )}
                </div>
                <Textarea
                  ref={(e) => {
                    subjectFieldRef?.(e);
                    subjectInputRef.current = e;
                  }}
                  rows={1}
                  disabled={readOnly}
                  className="my-0 focus:ring-transparent"
                  required
                  {...remainingSubjectProps}
                />
                {form.formState.errors.steps && form.formState?.errors?.steps[index]?.emailSubject && (
                  <p className="mt-1 text-xs text-red-500">
                    {form.formState?.errors?.steps[index]?.emailSubject?.message || ""}
                  </p>
                )}
              </div>
            )}

            <div className="mb-2 flex items-center pb-1">
              <Label className="mb-0 flex-none ">
                {subjectLineRequired ? t("email_body") : t("text_message")}
              </Label>
            </div>
            <Editor
              getText={() => {
                return form.getValues(`${fieldPath}.reminderBody`) || "";
              }}
              setText={(text: string) => {
                form.setValue(`${fieldPath}.reminderBody`, text);
                form.clearErrors();
              }}
              variables={DYNAMIC_TEXT_VARIABLES}
              addVariableButtonTop={isSmsAction(step.action)}
              height="200px"
              updateTemplate={templateRefreshTrigger}
              firstRender={initialRenderComplete}
              setFirstRender={setInitialRenderComplete}
              editable={!readOnly && !isWhatsappAction(step.action)}
              excludedToolbarItems={!isSmsAction(step.action) ? [] : ["blockType", "bold", "italic", "link"]}
              plainText={isSmsAction(step.action)}
            />

            {form.formState.errors.steps && form.formState?.errors?.steps[index]?.reminderBody && (
              <p className="mt-1 text-sm text-red-500">
                {form.formState?.errors?.steps[index]?.reminderBody?.message || ""}
              </p>
            )}

            {subjectLineRequired && (
              <div className="mt-2 flex items-center gap-1">
                <Controller
                  name={`${fieldPath}.includeCalendarEvent`}
                  control={form.control}
                  render={({ field: { value, onChange } }) => (
                    <Checkbox
                      id="include_calendar_event"
                      disabled={readOnly}
                      checked={value || false}
                      defaultChecked={form.getValues(`${fieldPath}.includeCalendarEvent`) || false}
                      onCheckedChange={(e) => {
                        onChange(e);
                        form.setValue(`${fieldPath}.includeCalendarEvent`, e ? true : false);
                      }}
                    />
                  )}
                />
                <Label htmlFor="include_calendar_event" className="text-sm text-gray-700">
                  {t("include_calendar_event")}
                </Label>
              </div>
            )}

            {!readOnly && (
              <div className="mt-3 ">
                <button type="button" onClick={() => setHelpDialogVisible(true)}>
                  <div className="text-default mt-2 flex text-sm">
                    <Icon name="circle-help" className="mt-[3px] h-3 w-3 ltr:mr-2 rtl:ml-2" />
                    <p className="text-left">{t("using_booking_questions_as_variables")}</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={helpDialogVisible}
        onOpenChange={setHelpDialogVisible}
        variant="warning"
        title={t("how_booking_questions_as_variables")}
        confirmBtnText={t("ok")}
        cancelBtnText=""
        onConfirm={() => setHelpDialogVisible(false)}
        size="lg">
        <div className="bg-muted-3 mb-6 rounded-md sm:p-4">
          <p className="text-sm font-medium">{t("format")}</p>
          <ul className="text-emphasis ml-5 mt-2 list-disc">
            <li>{t("uppercase_for_letters")}</li>
            <li>{t("replace_whitespaces_underscores")}</li>
            <li>{t("ignore_special_characters_booking_questions")}</li>
          </ul>

          <div className="mt-4">
            <p className="w-full text-sm font-medium">{t("example_1")}</p>
            <div className="mt-2 grid grid-cols-12">
              <div className="text-default col-span-5 text-sm ltr:mr-2 rtl:ml-2">
                {t("booking_question_identifier")}
              </div>
              <div className="text-emphasis col-span-7 text-sm">{t("company_size")}</div>
              <div className="text-default col-span-5 text-sm">{t("variable")}</div>
              <div className="text-emphasis col-span-7 break-words text-sm">
                {`{${t("company_size")
                  .replace(/[^a-zA-Z0-9 ]/g, "")
                  .trim()
                  .replace(/ /g, "_")
                  .toUpperCase()}}`}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="w-full text-sm font-medium">{t("example_2")}</p>
            <div className="mt-2 grid grid-cols-12">
              <div className="text-default col-span-5 text-sm ltr:mr-2 rtl:ml-2">
                {t("booking_question_identifier")}
              </div>
              <div className="text-emphasis col-span-7 text-sm">{t("what_help_needed")}</div>
              <div className="text-default col-span-5 text-sm">{t("variable")}</div>
              <div className="text-emphasis col-span-7 break-words text-sm">
                {`{${t("what_help_needed")
                  .replace(/[^a-zA-Z0-9 ]/g, "")
                  .trim()
                  .replace(/ /g, "_")
                  .toUpperCase()}}`}
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default WorkflowStepAction;
