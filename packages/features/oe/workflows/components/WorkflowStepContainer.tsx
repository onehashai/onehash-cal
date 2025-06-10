import type { WorkflowStep } from "@prisma/client";
import { type TFunction } from "i18next";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";
import "react-phone-number-input/style.css";

import { classNames } from "@calcom/lib";
import { SENDER_ID, SENDER_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import { TimeUnit, WorkflowActions, WorkflowTemplates, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import {
  AddVariablesDropdown,
  Badge,
  Button,
  CheckboxField,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Editor,
  EmailField,
  Icon,
  Input,
  Label,
  PhoneInput,
  Select,
  showToast,
  TextArea,
  TextField,
  Tooltip,
} from "@calcom/ui";

import {
  getWhatsappTemplateForAction,
  isAttendeeAction,
  isSMSAction,
  isSMSOrWhatsappAction,
  isWhatsappAction,
} from "../lib/actionHelperFunctions";
import { DYNAMIC_TEXT_VARIABLES } from "../lib/constants";
import { getWorkflowTemplateOptions, getWorkflowTriggerOptions } from "../lib/getOptions";
import emailRatingTemplate from "../lib/reminders/templates/emailRatingTemplate";
import emailReminderTemplate from "../lib/reminders/templates/emailReminderTemplate";
import emailThankYouTemplate from "../lib/reminders/templates/emailThankYouTemplate";
import smsReminderTemplate from "../lib/reminders/templates/smsReminderTemplate";
import { whatsappReminderTemplate } from "../lib/reminders/templates/whatsapp";
import type { FormValues } from "../pages/workflow";
import { TimeTimeUnitInput } from "./TimeTimeUnitInput";

type User = RouterOutputs["viewer"]["me"];

type WorkflowStepProps = {
  step?: WorkflowStep;
  form: UseFormReturn<FormValues>;
  user: User;
  reload?: boolean;
  setReload?: Dispatch<SetStateAction<boolean>>;
  teamId?: number;
  readOnly: boolean;
};

const retrieveTimeDisplayText = (triggerType: WorkflowTriggerEvents, translator: TFunction) => {
  const mappings: Partial<Record<WorkflowTriggerEvents, string>> = {
    [WorkflowTriggerEvents.AFTER_EVENT]: "how_long_after",
    [WorkflowTriggerEvents.BEFORE_EVENT]: "how_long_before",
    [WorkflowTriggerEvents.AFTER_HOSTS_CAL_VIDEO_NO_SHOW]: "how_long_after_hosts_no_show",
    [WorkflowTriggerEvents.AFTER_GUESTS_CAL_VIDEO_NO_SHOW]: "how_long_after_guests_no_show",
  };
  return mappings[triggerType] ? translator(mappings[triggerType]!) : null;
};

export default function WorkflowStepContainer(properties: WorkflowStepProps) {
  const { t, i18n } = useLocale();
  const utilsInstance = trpc.useUtils();

  const { step, form, reload, setReload, teamId } = properties;
  const { data: _validatedPhoneNumbers } = trpc.viewer.workflows.getVerifiedNumbers.useQuery(
    { teamId },
    { enabled: !!teamId }
  );

  const { data: _validatedEmails } = trpc.viewer.workflows.getVerifiedEmails.useQuery({ teamId });

  const timeDisplayFormat = getTimeFormatStringFromUserTimeFormat(properties.user.timeFormat);

  const confirmedNumbers = _validatedPhoneNumbers?.map((contact) => contact.phoneNumber) || [];
  const confirmedEmails = _validatedEmails || [];
  const [showAdditionalInputsModal, setShowAdditionalInputsModal] = useState(false);

  const [codeInput, setCodeInput] = useState("");

  const actionType = step?.action;
  const phoneNumberRequired =
    WorkflowActions.SMS_NUMBER === actionType || WorkflowActions.WHATSAPP_NUMBER === actionType;
  const [needsPhoneNumber, setNeedsPhoneNumber] = useState(phoneNumberRequired);

  const [shouldUpdateTemplate, setShouldUpdateTemplate] = useState(false);
  const [initialRender, setInitialRender] = useState(true);

  const requiresSender =
    step?.action === WorkflowActions.SMS_NUMBER || step?.action === WorkflowActions.SMS_ATTENDEE;

  const [senderRequired, setSenderRequired] = useState(requiresSender);

  const [emailAddressRequired, setEmailAddressRequired] = useState(
    step?.action === WorkflowActions.EMAIL_ADDRESS ? true : false
  );

  const [subjectRequired, setSubjectRequired] = useState(
    step?.action === WorkflowActions.EMAIL_ATTENDEE ||
      step?.action === WorkflowActions.EMAIL_HOST ||
      step?.action === WorkflowActions.EMAIL_ADDRESS
      ? true
      : false
  );

  const [timeDisplayText, setTimeDisplayText] = useState(
    retrieveTimeDisplayText(form.getValues("trigger"), t)
  );

  const { data: availableActions } = trpc.viewer.workflows.getWorkflowActionOptions.useQuery();
  const triggerChoices = getWorkflowTriggerOptions(t);
  const templateChoices = getWorkflowTemplateOptions(t, step?.action);

  if (step && form.getValues(`steps.${step.stepNumber - 1}.template`) === WorkflowTemplates.REMINDER) {
    if (!form.getValues(`steps.${step.stepNumber - 1}.reminderBody`)) {
      const actionValue = form.getValues(`steps.${step.stepNumber - 1}.action`);
      if (isSMSAction(actionValue)) {
        form.setValue(
          `steps.${step.stepNumber - 1}.reminderBody`,
          smsReminderTemplate(true, i18n.language, actionValue, timeDisplayFormat)
        );
      } else if (isWhatsappAction(actionValue)) {
        form.setValue(
          `steps.${step.stepNumber - 1}.reminderBody`,
          whatsappReminderTemplate(true, i18n.language, actionValue, timeDisplayFormat)
        );
      } else {
        const reminderContentTemplate = emailReminderTemplate(
          true,
          i18n.language,
          actionValue,
          timeDisplayFormat
        ).emailBody;
        form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, reminderContentTemplate);
      }
    }
    if (!form.getValues(`steps.${step.stepNumber - 1}.emailSubject`)) {
      const subjectContent = emailReminderTemplate(
        true,
        i18n.language,
        form.getValues(`steps.${step.stepNumber - 1}.action`),
        timeDisplayFormat
      ).emailSubject;
      form.setValue(`steps.${step.stepNumber - 1}.emailSubject`, subjectContent);
    }
  } else if (step && isWhatsappAction(step.action)) {
    const whatsappContent = getWhatsappTemplateForAction(
      step.action,
      i18n.language,
      step.template,
      timeDisplayFormat
    );
    form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, whatsappContent);
  }

  const { ref: subjectFieldRef, ...remainingSubjectProps } = step
    ? form.register(`steps.${step.stepNumber - 1}.emailSubject`)
    : { ref: null, name: "" };

  const subjectTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const checkNumberValidation = () =>
    !!step &&
    !!confirmedNumbers.find(
      (contact: string) => contact === form.getValues(`steps.${step.stepNumber - 1}.sendTo`)
    );

  const checkEmailValidation = () =>
    !!step &&
    !!confirmedEmails.find(
      (contact: string) => contact === form.getValues(`steps.${step.stepNumber - 1}.sendTo`)
    );

  const [phoneValidated, setPhoneValidated] = useState(checkNumberValidation());
  const [emailValidated, setEmailValidated] = useState(checkEmailValidation());

  useEffect(() => setPhoneValidated(checkNumberValidation()), [confirmedNumbers.length]);
  useEffect(() => setEmailValidated(checkEmailValidation()), [confirmedEmails.length]);

  const insertVariableIntoSubject = (variableName: string) => {
    if (step) {
      const currentSubjectText = subjectTextAreaRef?.current?.value || "";
      const caretPosition = subjectTextAreaRef?.current?.selectionStart || currentSubjectText.length;
      const updatedSubject = `${currentSubjectText.substring(0, caretPosition)}{${variableName
        .toUpperCase()
        .replace(/ /g, "_")}}${currentSubjectText.substring(caretPosition)}`;
      form.setValue(`steps.${step.stepNumber - 1}.emailSubject`, updatedSubject);
    }
  };

  const requestVerificationCode = trpc.viewer.workflows.sendVerificationCode.useMutation({
    onSuccess: async () => {
      showToast(t("verification_code_sent"), "success");
    },
    onError: async (error) => {
      showToast(error.message, "error");
    },
  });

  const confirmPhoneNumber = trpc.viewer.workflows.verifyPhoneNumber.useMutation({
    onSuccess: async (validationResult) => {
      showToast(validationResult ? t("verified_successfully") : t("wrong_code"), "success");
      setPhoneValidated(validationResult);
      if (
        step &&
        form?.formState?.errors?.steps &&
        form.formState.errors.steps[step.stepNumber - 1]?.sendTo &&
        validationResult
      ) {
        form.clearErrors(`steps.${step.stepNumber - 1}.sendTo`);
      }

      utilsInstance.viewer.workflows.getVerifiedNumbers.invalidate();
    },
    onError: (error) => {
      if (error instanceof HttpError) {
        const errorMessage = `${error.statusCode}: ${error.message}`;
        showToast(errorMessage, "error");
        setPhoneValidated(false);
      }
    },
  });

  const requestEmailVerification = trpc.viewer.auth.sendVerifyEmailCode.useMutation({
    onSuccess() {
      showToast(t("email_sent"), "success");
    },
    onError: () => {
      showToast(t("email_not_sent"), "error");
    },
  });

  const confirmEmailCode = trpc.viewer.workflows.verifyEmailCode.useMutation({
    onSuccess: (validationResult) => {
      showToast(validationResult ? t("verified_successfully") : t("wrong_code"), "success");
      setEmailValidated(true);
      if (
        step &&
        form?.formState?.errors?.steps &&
        form.formState.errors.steps[step.stepNumber - 1]?.sendTo &&
        validationResult
      ) {
        form.clearErrors(`steps.${step.stepNumber - 1}.sendTo`);
      }
      utilsInstance.viewer.workflows.getVerifiedEmails.invalidate();
    },
    onError: (error) => {
      if (error.message === "invalid_code") {
        showToast(t("code_provided_invalid"), "error");
        setEmailValidated(false);
      }
    },
  });

  if (!step) {
    const triggerValue = form.getValues("trigger");
    const triggerDisplayText = t(`${triggerValue.toLowerCase()}_trigger`);

    const chosenTrigger = {
      label: triggerDisplayText.charAt(0).toUpperCase() + triggerDisplayText.slice(1),
      value: triggerValue,
    };

    return (
      <>
        <div className="flex justify-center">
          <div className="bg-default border-subtle min-w-80 w-full rounded-md border p-7">
            <div className="flex">
              <div className="bg-subtle text-default mt-[3px] flex h-5 w-5 items-center justify-center rounded-full p-1 text-xs font-medium ltr:mr-5 rtl:ml-5">
                1
              </div>
              <div>
                <div className="text-emphasis text-base font-bold">{t("trigger")}</div>
                <div className="text-default text-sm">{t("when_something_happens")}</div>
              </div>
            </div>
            <div className="border-subtle my-7 border-t" />
            <Label>{t("when")}</Label>
            <Controller
              name="trigger"
              control={form.control}
              render={() => {
                return (
                  <Select
                    isSearchable={false}
                    className="text-sm"
                    id="trigger-select"
                    isDisabled={properties.readOnly}
                    onChange={(selection) => {
                      if (selection) {
                        form.setValue("trigger", selection.value);
                        const updatedTimeText = retrieveTimeDisplayText(selection.value, t);
                        if (updatedTimeText) {
                          setTimeDisplayText(updatedTimeText);
                          if (
                            selection.value === WorkflowTriggerEvents.AFTER_HOSTS_CAL_VIDEO_NO_SHOW ||
                            selection.value === WorkflowTriggerEvents.AFTER_GUESTS_CAL_VIDEO_NO_SHOW
                          ) {
                            form.setValue("time", 5);
                            form.setValue("timeUnit", TimeUnit.MINUTE);
                          } else {
                            form.setValue("time", 24);
                            form.setValue("timeUnit", TimeUnit.HOUR);
                          }
                        } else {
                          setTimeDisplayText(null);
                          form.unregister("time");
                          form.unregister("timeUnit");
                        }
                      }
                    }}
                    defaultValue={chosenTrigger}
                    options={triggerChoices}
                  />
                );
              }}
            />
            {!!timeDisplayText && (
              <div className="mt-5">
                <Label>{timeDisplayText}</Label>
                <TimeTimeUnitInput disabled={properties.readOnly} />
                {!properties.readOnly && (
                  <div className="mt-1 flex text-gray-500">
                    <Icon name="info" className="mr-1 mt-0.5 h-4 w-4" />
                    <p className="text-sm">{t("testing_workflow_info_message")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  if (step && step.action) {
    const actionDisplayText = t(`${step.action.toLowerCase()}_action`);

    const chosenAction = {
      label: actionDisplayText.charAt(0).toUpperCase() + actionDisplayText.slice(1),
      value: step.action,
      needsTeamsUpgrade: false,
    };

    const chosenTemplate = { label: t(`${step.template.toLowerCase()}`), value: step.template };

    const allowsPhoneNumberRequirement = (workflowActionType: string) => {
      return (
        WorkflowActions.SMS_ATTENDEE === workflowActionType ||
        WorkflowActions.WHATSAPP_ATTENDEE === workflowActionType
      );
    };

    return (
      <>
        <div className="my-3 flex justify-center">
          <Icon name="arrow-down" className="text-subtle stroke-[1.5px] text-3xl" />
        </div>
        <div className="flex justify-center">
          <div className="bg-default border-subtle min-w-80 flex w-full rounded-md border p-7">
            <div className="w-full">
              <div className="flex">
                <div className="w-full">
                  <div className="flex">
                    <div className="bg-subtle text-default mt-[3px] flex h-5 w-5 items-center justify-center rounded-full p-1 text-xs ltr:mr-5 rtl:ml-5">
                      {step.stepNumber + 1}
                    </div>
                    <div>
                      <div className="text-emphasis text-base font-bold">{t("action")}</div>
                      <div className="text-default text-sm">{t("action_is_performed")}</div>
                    </div>
                  </div>
                </div>
                {!properties.readOnly && (
                  <div>
                    <Dropdown>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" color="minimal" variant="icon" StartIcon="ellipsis" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <DropdownItem
                            type="button"
                            StartIcon="trash-2"
                            color="destructive"
                            onClick={() => {
                              const allSteps = form.getValues("steps");
                              const filteredSteps = allSteps
                                ?.filter((currentStep) => currentStep.id !== step.id)
                                .map((s) => {
                                  const modifiedStep = s;
                                  if (step.stepNumber < modifiedStep.stepNumber) {
                                    modifiedStep.stepNumber = modifiedStep.stepNumber - 1;
                                  }
                                  return modifiedStep;
                                });
                              form.setValue("steps", filteredSteps);
                              if (setReload) {
                                setReload(!reload);
                              }
                            }}>
                            {t("delete")}
                          </DropdownItem>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </Dropdown>
                  </div>
                )}
              </div>
              <div className="border-subtle my-7 border-t" />
              <div>
                <Label>{t("do_this")}</Label>
                <Controller
                  name={`steps.${step.stepNumber - 1}.action`}
                  control={form.control}
                  render={() => {
                    return (
                      <Select
                        isSearchable={false}
                        className="text-sm"
                        isDisabled={properties.readOnly}
                        onChange={(selection) => {
                          if (selection) {
                            const previousValue = form.getValues(`steps.${step.stepNumber - 1}.action`);

                            const configureNumberRequirements = (
                              requiresPhoneNumber: boolean,
                              requiresSender = true
                            ) => {
                              setSenderRequired(requiresSender);
                              setEmailAddressRequired(false);
                              setNeedsPhoneNumber(requiresPhoneNumber);
                              setPhoneValidated(checkNumberValidation());
                            };

                            if (isSMSAction(selection.value)) {
                              configureNumberRequirements(selection.value === WorkflowActions.SMS_NUMBER);
                              if (!isSMSAction(previousValue)) {
                                form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, "");
                                form.setValue(`steps.${step.stepNumber - 1}.sender`, SENDER_ID);
                              }

                              setSubjectRequired(false);
                            } else if (isWhatsappAction(selection.value)) {
                              configureNumberRequirements(
                                selection.value === WorkflowActions.WHATSAPP_NUMBER,
                                false
                              );

                              if (!isWhatsappAction(previousValue)) {
                                form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, "");
                                form.setValue(`steps.${step.stepNumber - 1}.sender`, "");
                              }

                              setSubjectRequired(false);
                            } else {
                              setNeedsPhoneNumber(false);
                              setSenderRequired(false);
                              setEmailAddressRequired(selection.value === WorkflowActions.EMAIL_ADDRESS);
                              setSubjectRequired(true);
                            }

                            if (
                              form.getValues(`steps.${step.stepNumber - 1}.template`) ===
                              WorkflowTemplates.REMINDER
                            ) {
                              if (
                                isSMSOrWhatsappAction(selection.value) ===
                                isSMSOrWhatsappAction(previousValue)
                              ) {
                                if (isAttendeeAction(previousValue) !== isAttendeeAction(selection.value)) {
                                  const currentContent =
                                    form.getValues(`steps.${step.stepNumber - 1}.reminderBody`) || "";
                                  const updatedContent = currentContent
                                    .replaceAll("{ORGANIZER}", "{PLACEHOLDER}")
                                    .replaceAll("{ATTENDEE}", "{ORGANIZER}")
                                    .replaceAll("{PLACEHOLDER}", "{ATTENDEE}");
                                  form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, updatedContent);

                                  if (!isSMSOrWhatsappAction(selection.value)) {
                                    const currentSubject =
                                      form.getValues(`steps.${step.stepNumber - 1}.emailSubject`) || "";
                                    const updatedSubject = isAttendeeAction(selection.value)
                                      ? currentSubject.replace("{ORGANIZER}", "{ATTENDEE}")
                                      : currentSubject.replace("{ATTENDEE}", "{ORGANIZER}");

                                    form.setValue(
                                      `steps.${step.stepNumber - 1}.emailSubject`,
                                      updatedSubject || ""
                                    );
                                  }
                                }
                              } else {
                                if (isSMSAction(selection.value)) {
                                  form.setValue(
                                    `steps.${step.stepNumber - 1}.reminderBody`,
                                    smsReminderTemplate(
                                      true,
                                      i18n.language,
                                      selection.value,
                                      timeDisplayFormat
                                    )
                                  );
                                } else if (isWhatsappAction(selection.value)) {
                                  form.setValue(
                                    `steps.${step.stepNumber - 1}.reminderBody`,
                                    whatsappReminderTemplate(
                                      true,
                                      i18n.language,
                                      selection.value,
                                      timeDisplayFormat
                                    )
                                  );
                                } else {
                                  const emailContent = emailReminderTemplate(
                                    true,
                                    i18n.language,
                                    selection.value,
                                    timeDisplayFormat
                                  );
                                  form.setValue(
                                    `steps.${step.stepNumber - 1}.reminderBody`,
                                    emailContent.emailBody
                                  );
                                  form.setValue(
                                    `steps.${step.stepNumber - 1}.emailSubject`,
                                    emailContent.emailSubject
                                  );
                                }
                              }
                            } else {
                              const templateType = isWhatsappAction(selection.value) ? "REMINDER" : "CUSTOM";
                              templateType &&
                                form.setValue(`steps.${step.stepNumber - 1}.template`, templateType);
                            }
                            form.unregister(`steps.${step.stepNumber - 1}.sendTo`);
                            form.clearErrors(`steps.${step.stepNumber - 1}.sendTo`);
                            form.setValue(`steps.${step.stepNumber - 1}.action`, selection.value);
                            setShouldUpdateTemplate(!shouldUpdateTemplate);
                          }
                        }}
                        defaultValue={chosenAction}
                        options={availableActions?.map((option) => ({
                          ...option,
                        }))}
                        isOptionDisabled={(option: {
                          label: string;
                          value: WorkflowActions;
                          needsTeamsUpgrade: boolean;
                        }) => option.needsTeamsUpgrade}
                      />
                    );
                  }}
                />
              </div>
              {needsPhoneNumber && (
                <div className="bg-muted mt-2 rounded-md p-4 pt-0">
                  <Label className="pt-4">{t("custom_phone_number")}</Label>
                  <div className="block sm:flex">
                    <Controller
                      name={`steps.${step.stepNumber - 1}.sendTo`}
                      render={({ field: { value, onChange } }) => (
                        <PhoneInput
                          placeholder={t("phone_number")}
                          id={`steps.${step.stepNumber - 1}.sendTo`}
                          className="min-w-fit sm:rounded-r-none sm:rounded-bl-md sm:rounded-tl-md"
                          required
                          disabled={properties.readOnly}
                          value={value}
                          onChange={(phoneValue) => {
                            const alreadyValidated = !!confirmedNumbers
                              ?.concat([])
                              .find(
                                (contact) => contact.replace(/\s/g, "") === phoneValue?.replace(/\s/g, "")
                              );
                            setPhoneValidated(alreadyValidated);
                            onChange(phoneValue);
                          }}
                        />
                      )}
                    />
                    <Button
                      color="secondary"
                      disabled={phoneValidated || properties.readOnly || false}
                      className={classNames(
                        "-ml-[3px] h-[40px] min-w-fit sm:block sm:rounded-bl-none sm:rounded-tl-none",
                        phoneValidated ? "hidden" : "mt-3 sm:mt-0"
                      )}
                      onClick={() =>
                        requestVerificationCode.mutate({
                          phoneNumber: form.getValues(`steps.${step.stepNumber - 1}.sendTo`) || "",
                        })
                      }>
                      {t("send_code")}
                    </Button>
                  </div>

                  {form.formState.errors.steps &&
                    form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo && (
                      <p className="mt-1 text-xs text-red-500">
                        {form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo?.message || ""}
                      </p>
                    )}
                  {phoneValidated ? (
                    <div className="mt-1">
                      <Badge variant="green">{t("number_verified")}</Badge>
                    </div>
                  ) : (
                    !properties.readOnly && (
                      <>
                        <div className="mt-3 flex">
                          <TextField
                            className="rounded-r-none border-r-transparent"
                            placeholder="Verification code"
                            disabled={properties.readOnly}
                            value={codeInput}
                            onChange={(e) => {
                              setCodeInput(e.target.value);
                            }}
                            required
                          />
                          <Button
                            color="secondary"
                            className="-ml-[3px] h-[36px] min-w-fit py-0 sm:block sm:rounded-bl-none sm:rounded-tl-none "
                            disabled={confirmPhoneNumber.isPending || properties.readOnly}
                            onClick={() => {
                              confirmPhoneNumber.mutate({
                                phoneNumber: form.getValues(`steps.${step.stepNumber - 1}.sendTo`) || "",
                                code: codeInput,
                                teamId,
                              });
                            }}>
                            {t("verify")}
                          </Button>
                        </div>
                        {form.formState.errors.steps &&
                          form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo && (
                            <p className="mt-1 text-xs text-red-500">
                              {form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo?.message || ""}
                            </p>
                          )}
                      </>
                    )
                  )}
                </div>
              )}
              {!isWhatsappAction(form.getValues(`steps.${step.stepNumber - 1}.action`)) && (
                <div className="bg-muted mt-2 rounded-md p-4 pt-0">
                  {senderRequired ? (
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
                          disabled={properties.readOnly}
                          maxLength={11}
                          {...form.register(`steps.${step.stepNumber - 1}.sender`)}
                        />
                      </div>
                      {form.formState.errors.steps &&
                        form.formState?.errors?.steps[step.stepNumber - 1]?.sender && (
                          <p className="mt-1 text-xs text-red-500">{t("sender_id_error_message")}</p>
                        )}
                    </>
                  ) : (
                    <>
                      <div className="pt-4">
                        <Label>{t("sender_name")}</Label>
                        <Input
                          type="text"
                          disabled={properties.readOnly}
                          placeholder={SENDER_NAME}
                          {...form.register(`steps.${step.stepNumber - 1}.senderName`)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {allowsPhoneNumberRequirement(form.getValues(`steps.${step.stepNumber - 1}.action`)) && (
                <div className="mt-2">
                  <Controller
                    name={`steps.${step.stepNumber - 1}.numberRequired`}
                    control={form.control}
                    render={() => (
                      <CheckboxField
                        disabled={properties.readOnly}
                        defaultChecked={
                          form.getValues(`steps.${step.stepNumber - 1}.numberRequired`) || false
                        }
                        description={t("make_phone_number_required")}
                        onChange={(e) =>
                          form.setValue(`steps.${step.stepNumber - 1}.numberRequired`, e.target.checked)
                        }
                      />
                    )}
                  />
                </div>
              )}
              {emailAddressRequired && (
                <div className="bg-muted mt-5 rounded-md p-4">
                  <Label>{t("email_address")}</Label>
                  <div className="block sm:flex">
                    <Controller
                      name={`steps.${step.stepNumber - 1}.sendTo`}
                      render={({ field: { value, onChange } }) => (
                        <EmailField
                          required
                          containerClassName="w-full"
                          className="h-10 min-w-fit sm:rounded-r-none sm:rounded-bl-md sm:rounded-tl-md"
                          placeholder={t("email_address")}
                          value={value}
                          disabled={properties.readOnly}
                          onChange={(emailValue) => {
                            const alreadyValidated = !!confirmedEmails
                              ?.concat([])
                              .find((contact) => contact === emailValue.target.value);
                            setEmailValidated(alreadyValidated);
                            onChange(emailValue);
                          }}
                        />
                      )}
                    />
                    <Button
                      color="secondary"
                      disabled={emailValidated || properties.readOnly || false}
                      className={classNames(
                        "-ml-[3px] h-[40px] min-w-fit sm:block sm:rounded-bl-none sm:rounded-tl-none",
                        emailValidated ? "hidden" : "mt-3 sm:mt-0"
                      )}
                      onClick={() => {
                        const emailAddress = form.getValues(`steps.${step.stepNumber - 1}.sendTo`) || "";
                        requestEmailVerification.mutate({
                          email: emailAddress,
                          isVerifyingEmail: true,
                        });
                      }}>
                      {t("send_code")}
                    </Button>
                  </div>

                  {form.formState.errors.steps &&
                    form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo && (
                      <p className="mt-1 text-xs text-red-500">
                        {form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo?.message || ""}
                      </p>
                    )}

                  {emailValidated ? (
                    <div className="mt-1">
                      <Badge variant="green">{t("email_verified")}</Badge>
                    </div>
                  ) : (
                    !properties.readOnly && (
                      <>
                        <div className="mt-3 flex">
                          <TextField
                            className="rounded-r-none border-r-transparent"
                            placeholder="Verification code"
                            disabled={properties.readOnly}
                            value={codeInput}
                            onChange={(e) => {
                              setCodeInput(e.target.value);
                            }}
                            required
                          />
                          <Button
                            color="secondary"
                            className="-ml-[3px] h-[36px] min-w-fit py-0 sm:block sm:rounded-bl-none sm:rounded-tl-none "
                            disabled={confirmEmailCode.isPending || properties.readOnly}
                            onClick={() => {
                              confirmEmailCode.mutate({
                                code: codeInput,
                                email: form.getValues(`steps.${step.stepNumber - 1}.sendTo`) || "",
                                teamId,
                              });
                            }}>
                            {t("verify")}
                          </Button>
                        </div>
                        {form.formState.errors.steps &&
                          form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo && (
                            <p className="mt-1 text-xs text-red-500">
                              {form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo?.message || ""}
                            </p>
                          )}
                      </>
                    )
                  )}
                </div>
              )}
              <div className="mt-5">
                <Label>{t("message_template")}</Label>
                <Controller
                  name={`steps.${step.stepNumber - 1}.template`}
                  control={form.control}
                  render={({ field }) => {
                    return (
                      <Select
                        isSearchable={false}
                        className="text-sm"
                        isDisabled={properties.readOnly}
                        onChange={(selection) => {
                          if (selection) {
                            const actionValue = form.getValues(`steps.${step.stepNumber - 1}.action`);
                            if (selection.value === WorkflowTemplates.REMINDER) {
                              if (isWhatsappAction(actionValue)) {
                                form.setValue(
                                  `steps.${step.stepNumber - 1}.reminderBody`,
                                  whatsappReminderTemplate(
                                    true,
                                    i18n.language,
                                    actionValue,
                                    timeDisplayFormat
                                  )
                                );
                              } else if (isSMSAction(actionValue)) {
                                form.setValue(
                                  `steps.${step.stepNumber - 1}.reminderBody`,
                                  smsReminderTemplate(true, i18n.language, actionValue, timeDisplayFormat)
                                );
                              } else {
                                form.setValue(
                                  `steps.${step.stepNumber - 1}.reminderBody`,
                                  emailReminderTemplate(true, i18n.language, actionValue, timeDisplayFormat)
                                    .emailBody
                                );
                                form.setValue(
                                  `steps.${step.stepNumber - 1}.emailSubject`,
                                  emailReminderTemplate(true, i18n.language, actionValue, timeDisplayFormat)
                                    .emailSubject
                                );
                              }
                            } else if (selection.value === WorkflowTemplates.RATING) {
                              form.setValue(
                                `steps.${step.stepNumber - 1}.reminderBody`,
                                emailRatingTemplate({
                                  isEditingMode: true,
                                  locale: i18n.language,
                                  action: actionValue,
                                  timeFormat: timeDisplayFormat,
                                }).emailBody
                              );
                              form.setValue(
                                `steps.${step.stepNumber - 1}.emailSubject`,
                                emailRatingTemplate({
                                  isEditingMode: true,
                                  locale: i18n.language,
                                  action: actionValue,
                                  timeFormat: timeDisplayFormat,
                                }).emailSubject
                              );
                            } else if (selection.value === WorkflowTemplates.THANKYOU) {
                              form.setValue(
                                `steps.${step.stepNumber - 1}.reminderBody`,
                                emailThankYouTemplate({ isEditingMode: true, timeFormat: timeDisplayFormat })
                                  .emailBody
                              );
                              form.setValue(
                                `steps.${step.stepNumber - 1}.emailSubject`,
                                emailThankYouTemplate({ isEditingMode: true, timeFormat: timeDisplayFormat })
                                  .emailSubject
                              );
                            } else {
                              if (isWhatsappAction(actionValue)) {
                                form.setValue(
                                  `steps.${step.stepNumber - 1}.reminderBody`,
                                  getWhatsappTemplateForAction(
                                    actionValue,
                                    i18n.language,
                                    selection.value,
                                    timeDisplayFormat
                                  )
                                );
                              } else {
                                form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, "");
                                form.setValue(`steps.${step.stepNumber - 1}.emailSubject`, "");
                              }
                            }
                            field.onChange(selection.value);
                            form.setValue(`steps.${step.stepNumber - 1}.template`, selection.value);
                            setShouldUpdateTemplate(!shouldUpdateTemplate);
                          }
                        }}
                        defaultValue={chosenTemplate}
                        value={chosenTemplate}
                        options={templateChoices}
                      />
                    );
                  }}
                />
              </div>
              <div className="bg-muted mt-2 rounded-md pt-2 md:p-6 md:pt-4">
                {subjectRequired && (
                  <div className="mb-6">
                    <div className="flex items-center">
                      <Label className={classNames("flex-none", properties.readOnly ? "mb-2" : "mb-0")}>
                        {t("email_subject")}
                      </Label>
                      {!properties.readOnly && (
                        <div className="flex-grow text-right">
                          <AddVariablesDropdown
                            addVariable={insertVariableIntoSubject}
                            variables={DYNAMIC_TEXT_VARIABLES}
                          />
                        </div>
                      )}
                    </div>
                    <TextArea
                      ref={(element) => {
                        subjectFieldRef?.(element);
                        subjectTextAreaRef.current = element;
                      }}
                      rows={1}
                      disabled={properties.readOnly}
                      className="my-0 focus:ring-transparent"
                      required
                      {...remainingSubjectProps}
                    />
                    {form.formState.errors.steps &&
                      form.formState?.errors?.steps[step.stepNumber - 1]?.emailSubject && (
                        <p className="mt-1 text-xs text-red-500">
                          {form.formState?.errors?.steps[step.stepNumber - 1]?.emailSubject?.message || ""}
                        </p>
                      )}
                  </div>
                )}

                <div className="mb-2 flex items-center pb-1">
                  <Label className="mb-0 flex-none ">
                    {subjectRequired ? t("email_body") : t("text_message")}
                  </Label>
                </div>
                <Editor
                  getText={() => {
                    return properties.form.getValues(`steps.${step.stepNumber - 1}.reminderBody`) || "";
                  }}
                  setText={(textContent: string) => {
                    properties.form.setValue(`steps.${step.stepNumber - 1}.reminderBody`, textContent);
                    properties.form.clearErrors();
                  }}
                  variables={DYNAMIC_TEXT_VARIABLES}
                  addVariableButtonTop={isSMSAction(step.action)}
                  height="200px"
                  updateTemplate={shouldUpdateTemplate}
                  firstRender={initialRender}
                  setFirstRender={setInitialRender}
                  editable={!properties.readOnly && !isWhatsappAction(step.action)}
                  excludedToolbarItems={
                    !isSMSAction(step.action) ? [] : ["blockType", "bold", "italic", "link"]
                  }
                  plainText={isSMSAction(step.action)}
                />

                {form.formState.errors.steps &&
                  form.formState?.errors?.steps[step.stepNumber - 1]?.reminderBody && (
                    <p className="mt-1 text-sm text-red-500">
                      {form.formState?.errors?.steps[step.stepNumber - 1]?.reminderBody?.message || ""}
                    </p>
                  )}
                {subjectRequired && (
                  <div className="mt-2">
                    <Controller
                      name={`steps.${step.stepNumber - 1}.includeCalendarEvent`}
                      control={form.control}
                      render={() => (
                        <CheckboxField
                          disabled={properties.readOnly}
                          defaultChecked={
                            form.getValues(`steps.${step.stepNumber - 1}.includeCalendarEvent`) || false
                          }
                          description={t("include_calendar_event")}
                          onChange={(e) =>
                            form.setValue(
                              `steps.${step.stepNumber - 1}.includeCalendarEvent`,
                              e.target.checked
                            )
                          }
                        />
                      )}
                    />
                  </div>
                )}
                {!properties.readOnly && (
                  <div className="mt-3 ">
                    <button type="button" onClick={() => setShowAdditionalInputsModal(true)}>
                      <div className="text-default mt-2 flex text-sm">
                        <Icon name="circle-help" className="mt-[3px] h-3 w-3 ltr:mr-2 rtl:ml-2" />
                        <p className="text-left">{t("using_booking_questions_as_variables")}</p>
                      </div>
                    </button>
                  </div>
                )}
                {/* {form.getValues(`steps.${step.stepNumber - 1}.action`) !== WorkflowActions.SMS_ATTENDEE && (
                <Button
                  type="button"
                  className="w-full mt-7"
                  onClick={() => {
                    let isEmpty = false;

                    if (!form.getValues(`steps.${step.stepNumber - 1}.sendTo`) && isPhoneNumberNeeded) {
                      form.setError(`steps.${step.stepNumber - 1}.sendTo`, {
                        type: "custom",
                        message: t("no_input"),
                      });
                      isEmpty = true;
                    }

                    if (!numberVerified && isPhoneNumberNeeded) {
                      form.setError(`steps.${step.stepNumber - 1}.sendTo`, {
                        type: "custom",
                        message: t("not_verified"),
                      });
                    }
                    if (
                      form.getValues(`steps.${step.stepNumber - 1}.template`) === WorkflowTemplates.CUSTOM
                    ) {
                      if (!form.getValues(`steps.${step.stepNumber - 1}.reminderBody`)) {
                        form.setError(`steps.${step.stepNumber - 1}.reminderBody`, {
                          type: "custom",
                          message: t("no_input"),
                        });
                        isEmpty = true;
                      } else if (
                        isEmailSubjectNeeded &&
                        !form.getValues(`steps.${step.stepNumber - 1}.emailSubject`)
                      ) {
                        form.setError(`steps.${step.stepNumber - 1}.emailSubject`, {
                          type: "custom",
                          message: t("no_input"),
                        });
                        isEmpty = true;
                      }
                    }

                    if (!isPhoneNumberNeeded && !isEmpty) {
                      //translate body and reminder to english
                      const emailSubject = translateVariablesToEnglish(
                        form.getValues(`steps.${step.stepNumber - 1}.emailSubject`) || "",
                        { locale: i18n.language, t }
                      );
                      const reminderBody = translateVariablesToEnglish(
                        form.getValues(`steps.${step.stepNumber - 1}.reminderBody`) || "",
                        { locale: i18n.language, t }
                      );

                      testActionMutation.mutate({
                        step,
                        emailSubject,
                        reminderBody,
                      });
                    } else {
                      const isNumberValid =
                        form.formState.errors.steps &&
                        form.formState?.errors?.steps[step.stepNumber - 1]?.sendTo
                          ? false
                          : true;

                      if (isPhoneNumberNeeded && isNumberValid && !isEmpty && numberVerified) {
                        setConfirmationDialogOpen(true);
                      }
                    }
                  }}
                  color="secondary">
                  <div className="w-full">{t("test_action")}</div>
                </Button>
              )*/}
              </div>
            </div>
          </div>
        </div>
        {/* <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
          <ConfirmationDialogContent
            variety="warning"
            title={t("test_workflow_action")}
            confirmBtnText={t("send_sms")}
            onConfirm={(e) => {
              e.preventDefault();
              const reminderBody = translateVariablesToEnglish(
                form.getValues(`steps.${step.stepNumber - 1}.reminderBody`) || "",
                { locale: i18n.language, t }
              );

              testActionMutation.mutate({
                step,
                emailSubject: "",
                reminderBody: reminderBody || "",
              });
              setConfirmationDialogOpen(false);
            }}>
            {t("send_sms_to_number", { number: form.getValues(`steps.${step.stepNumber - 1}.sendTo`) })}
          </ConfirmationDialogContent>
        </Dialog> */}
        <Dialog open={showAdditionalInputsModal} onOpenChange={setShowAdditionalInputsModal}>
          <DialogContent enableOverflow type="creation" className="sm:max-w-[610px]">
            <div>
              <h1 className="w-full text-xl font-semibold ">{t("how_booking_questions_as_variables")}</h1>
              <div className="bg-muted-3 mb-6 rounded-md sm:p-4">
                <p className="test-sm font-medium">{t("format")}</p>
                <ul className="text-emphasis ml-5 mt-2 list-disc">
                  <li>{t("uppercase_for_letters")}</li>
                  <li>{t("replace_whitespaces_underscores")}</li>
                  <li>{t("ignore_special_characters_booking_questions")}</li>
                </ul>
                <div className="mt-4">
                  <p className="test-sm w-full font-medium">{t("example_1")}</p>
                  <div className="mt-2 grid grid-cols-12">
                    <div className="test-sm text-default col-span-5 ltr:mr-2 rtl:ml-2">
                      {t("booking_question_identifier")}
                    </div>
                    <div className="test-sm text-emphasis col-span-7">{t("company_size")}</div>
                    <div className="test-sm text-default col-span-5 w-full">{t("variable")}</div>

                    <div className="test-sm text-emphasis col-span-7 break-words">
                      {" "}
                      {`{${t("company_size")
                        .replace(/[^a-zA-Z0-9 ]/g, "")
                        .trim()
                        .replace(/ /g, "_")
                        .toUpperCase()}}`}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="test-sm w-full font-medium">{t("example_2")}</p>
                  <div className="mt-2 grid grid-cols-12">
                    <div className="test-sm text-default col-span-5 ltr:mr-2 rtl:ml-2">
                      {t("booking_question_identifier")}
                    </div>
                    <div className="test-sm text-emphasis col-span-7">{t("what_help_needed")}</div>
                    <div className="test-sm text-default col-span-5">{t("variable")}</div>
                    <div className="test-sm text-emphasis col-span-7 break-words">
                      {" "}
                      {`{${t("what_help_needed")
                        .replace(/[^a-zA-Z0-9 ]/g, "")
                        .trim()
                        .replace(/ /g, "_")
                        .toUpperCase()}}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter showDivider>
              <DialogClose color="primary" />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return <></>;
}
