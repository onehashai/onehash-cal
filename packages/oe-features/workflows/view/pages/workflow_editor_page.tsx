import { zodResolver } from "@hookform/resolvers/zod";
import type { Option } from "@onehash/oe-features/ui";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextField,
  Checkbox,
  MultiSelect,
} from "@onehash/oe-features/ui";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Controller } from "react-hook-form";
import { useForm } from "react-hook-form";

import Shell from "@calcom/features/shell/Shell";
import { SENDER_ID, SENDER_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { HttpError } from "@calcom/lib/http-error";
import {
  TimeUnit,
  WorkflowActions,
  WorkflowTemplates,
  WorkflowTriggerEvents,
  MembershipRole,
} from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { showToast } from "@calcom/ui";

import { TIME_UNITS } from "../../config/constants";
import type { WorkflowPageProps, WorkflowFormValues, WorkflowStep } from "../../config/types";
import {
  getTimeSectionText,
  getTimeUnitOptions,
  getWorkflowTriggerOptions,
  isSmsAction,
  translateTextVariables,
  translateVariablesToEnglish,
} from "../../config/utils";
import { querySchema, workflowFormSchema } from "../../config/validation";
import { WorkflowDeleteDialog } from "../components/workflow_delete_dialog";
import WorkflowStepAction from "../components/workflow_step_action";

const WorkflowEditor: React.FC<WorkflowPageProps> = ({
  workflowData: initialWorkflowData,
  verifiedNumbers: initialVerifiedNumbers,
  verifiedEmails: initialVerifiedEmails,
}) => {
  const { t, i18n } = useLocale();
  const trpcUtils = trpc.useUtils();
  const routeParams = useParamsWithFallback();
  const navigationRouter = useRouter();
  const userSession = useSession();
  const currentUserQuery = useMeQuery();

  const [confirmationDialogVisible, setConfirmationDialogVisible] = useState(false);
  const [targetWorkflowId, setTargetWorkflowId] = useState(0);
  const [chosenEventTypes, setChosenEventTypes] = useState<Option[]>([]);
  const [schedulingTextDisplay, setSchedulingTextDisplay] = useState<string | null>(null);
  // Add a counter to ensure unique IDs for new steps
  const [stepIdCounter, setStepIdCounter] = useState(-1);

  const { workflow: automationId } = routeParams ? querySchema.parse(routeParams) : { workflow: -1 };

  const {
    data: fetchedWorkflowData,
    isError: _hasError,
    error: fetchError,
    isPending: _isLoadingWorkflow,
  } = trpc.viewer.workflows.get.useQuery(
    { id: +automationId },
    {
      enabled: initialWorkflowData ? false : !!automationId,
    }
  );

  const currentWorkflow = initialWorkflowData || fetchedWorkflowData;
  const workflowIsLoading = initialWorkflowData ? false : _isLoadingWorkflow;
  const activeUser = currentUserQuery.data;

  const { data: phoneNumberData } = trpc.viewer.workflows.getVerifiedNumbers.useQuery(
    { teamId: currentWorkflow?.team?.id },
    {
      enabled: initialVerifiedNumbers ? false : !!currentWorkflow?.id,
    }
  );

  const { data: emailAddressData } = trpc.viewer.workflows.getVerifiedEmails.useQuery(
    {
      teamId: currentWorkflow?.team?.id,
    },
    { enabled: !initialVerifiedEmails }
  );

  const organizationFlag = currentWorkflow?.team?.isOrganization ?? false;
  const associatedTeamId = currentWorkflow?.teamId ?? undefined;
  const { data: eventOptionsData, isPending: loadingEventTypes } =
    trpc.viewer.eventTypes.getTeamAndEventTypeOptions.useQuery(
      { teamId: associatedTeamId, isOrg: organizationFlag },
      { enabled: !workflowIsLoading }
    );

  const { data: availableActions } = trpc.viewer.workflows.getWorkflowActionOptions.useQuery();

  const validatedPhoneNumbers = initialVerifiedNumbers || phoneNumberData;
  const validatedEmails = initialVerifiedEmails || emailAddressData;
  const completeEventTypeList = eventOptionsData?.eventTypeOptions ?? [];

  const isReadOnlyMode =
    currentWorkflow?.team?.members?.find((member) => member.userId === userSession?.data?.user.id)?.role ===
    MembershipRole.MEMBER;

  const formController = useForm<WorkflowFormValues>({
    mode: "onBlur",
    resolver: zodResolver(workflowFormSchema),
  });

  const observedSteps = formController.watch("steps");

  const triggerChoices = getWorkflowTriggerOptions(t);
  const timeUnitChoices = getTimeUnitOptions(t);

  const modificationMutation = trpc.viewer.workflows.update.useMutation({
    onSuccess: async ({ workflow }) => {
      if (workflow) {
        trpcUtils.viewer.workflows.get.setData({ id: +workflow.id }, workflow);
        showToast(
          t("workflow_updated_successfully", {
            workflowName: workflow.name,
          }),
          "success"
        );
      }
    },
    onError: (err) => {
      console.error("Error updating workflow:", err);
      if (err instanceof HttpError) {
        const errorMessage = `${err.statusCode}: ${err.message}`;
        showToast(errorMessage, "error");
      }
    },
  });

  const executeWorkflowDeletion = async (): Promise<void> => {
    setConfirmationDialogVisible(true);
    setTargetWorkflowId(+automationId);
  };

  const persistWorkflowChanges = async (): Promise<void> => {
    const formValues = formController.getValues();

    // Validate form before submission
    const isValid = await formController.trigger();
    if (!isValid) {
      console.log("Form validation failed:", formController.formState.errors);
      showToast(t("form_error"), "error");
      return;
    }

    const processedSteps = formValues.steps.map((step, index) => ({
      ...step,
      stepNumber: index + 1, // Ensure stepNumber is sequential
      reminderBody: step.reminderBody
        ? translateVariablesToEnglish(step.reminderBody, { locale: i18n.language, t })
        : null,
      emailSubject: step.emailSubject
        ? translateVariablesToEnglish(step.emailSubject, { locale: i18n.language, t })
        : null,
      template: step.template as "CANCELLED" | "REMINDER" | "CUSTOM" | "RESCHEDULED" | "COMPLETED" | "RATING",
    }));

    const enabledEventIds = formValues.activeOn
      .filter((option) => option.value !== "all")
      .map((option) => {
        return parseInt(option.value, 10);
      });

    const updatePayload = {
      ...formValues,
      steps: processedSteps,
      id: +automationId,
      time: formValues.time === undefined ? null : formValues.time,
      timeUnit: formValues.timeUnit === undefined ? null : formValues.timeUnit,
      activeOn: enabledEventIds,
    };

    modificationMutation.mutate(updatePayload);
  };

  const modifyTriggerSelection = (selectedTrigger: WorkflowTriggerEvents): void => {
    const updatedSchedulingText = getTimeSectionText(selectedTrigger, t);

    if (updatedSchedulingText) {
      setSchedulingTextDisplay(updatedSchedulingText);

      if (
        selectedTrigger === WorkflowTriggerEvents.AFTER_HOSTS_CAL_VIDEO_NO_SHOW ||
        selectedTrigger === WorkflowTriggerEvents.AFTER_GUESTS_CAL_VIDEO_NO_SHOW
      ) {
        formController.setValue("time", 5);
        formController.setValue("timeUnit", TimeUnit.MINUTE);
      } else {
        formController.setValue("time", 24);
        formController.setValue("timeUnit", TimeUnit.HOUR);
      }
    } else {
      setSchedulingTextDisplay(null);
      formController.unregister("time");
      formController.unregister("timeUnit");
    }
  };

  const processEventTypeChoice = (selectedChoices: Option[]): void => {
    formController.setValue("activeOn", selectedChoices);
    setChosenEventTypes(selectedChoices);

    if (selectedChoices.length === completeEventTypeList.length) {
      formController.setValue("selectAll", true);
    } else {
      formController.setValue("selectAll", false);
    }
  };

  const toggleAllEventTypes = (selectAllFlag: boolean): void => {
    formController.setValue("selectAll", selectAllFlag);
    const eventTypesToApply = selectAllFlag ? completeEventTypeList : [];
    setChosenEventTypes(eventTypesToApply);
    formController.setValue("activeOn", eventTypesToApply);
  };

  const eliminateAction = (removalIndex: number): void => {
    const existingSteps = formController.getValues("steps") || [];

    if (removalIndex < 0 || removalIndex >= existingSteps.length) {
      showToast("Invalid action index", "error");
      return;
    }

    const filteredSteps = existingSteps.filter((_, index) => index !== removalIndex);

    const renumberedSteps = filteredSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
    }));

    formController.setValue("steps", renumberedSteps, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    formController.clearErrors();
    formController.trigger("steps");

    showToast(t("action_removed_successfully"), "success");
  };

  const appendAction = (): void => {
    const currentStepList = formController.getValues("steps") || [];

    setStepIdCounter((prev) => prev - 1);

    const freshStep = {
      id: stepIdCounter - 1, // Using negative ID for new steps
      stepNumber: currentStepList.length + 1,
      action: WorkflowActions.EMAIL_HOST,
      template: WorkflowTemplates.CUSTOM,
      reminderBody: "",
      emailSubject: "",
      sender: SENDER_NAME,
      senderName: SENDER_NAME,
      sendTo: null,
      numberRequired: false,
      includeCalendarEvent: false,
      workflowId: currentWorkflow?.id ?? 0,
      numberVerificationPending: false,
    };

    const expandedSteps = [...currentStepList, freshStep] as (WorkflowStep & { senderName: string | null })[];

    formController.setValue("steps", expandedSteps, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });

    // Trigger validation for the steps array
    setTimeout(() => {
      formController.trigger("steps");
    }, 0);

    showToast(t("new_action_added"), "success");
  };

  useEffect(() => {
    if (workflowIsLoading) {
      return;
    }

    if (currentWorkflow) {
      const processedSteps = currentWorkflow.steps?.map((step, index) => {
        const modifiedStep = {
          ...step,
          stepNumber: index + 1, // Ensure sequential step numbers
          senderName: step.sender,
          sender: isSmsAction(step.action) ? step.sender : SENDER_ID,
        };

        if (step.reminderBody) {
          modifiedStep.reminderBody = translateTextVariables(step.reminderBody || "", {
            locale: i18n.language,
            t,
          });
        }

        if (step.emailSubject) {
          modifiedStep.emailSubject = translateTextVariables(step.emailSubject || "", {
            locale: i18n.language,
            t,
          });
        }

        return modifiedStep;
      });

      formController.reset({
        name: currentWorkflow.name,
        activeOn: currentWorkflow.activeOn.map((event) => ({
          value: event.eventType.id.toString(),
          label: event.eventType.title,
        })),
        steps: processedSteps,
        trigger: currentWorkflow.trigger,
        time: currentWorkflow.time || undefined,
        timeUnit: currentWorkflow.timeUnit || undefined,
        selectAll: false,
      });

      setSchedulingTextDisplay(getTimeSectionText(currentWorkflow.trigger, t));

      const defaultEventTypes = currentWorkflow.activeOn.map((event) => ({
        value: event.eventType.id.toString(),
        label: event.eventType.title,
      }));
      setChosenEventTypes(defaultEventTypes);
    }
  }, [workflowIsLoading, currentWorkflow, i18n.language, t, formController]);

  useEffect(() => {
    if (!currentWorkflow && !workflowIsLoading && automationId !== -1) {
      showToast(t("workflow_not_found"), "error");
      navigationRouter.replace("/workflows");
    }
  }, [currentWorkflow, workflowIsLoading, automationId, navigationRouter]);

  if (workflowIsLoading) {
    return (
      <Shell withoutMain>
        <div className="bg-default min-h-screen">
          <div className="mx-auto px-6 py-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="bg-emphasis h-8 w-48 animate-pulse  rounded" />
              <div className="flex gap-2">
                <div className="bg-emphasis h-10 w-32 animate-pulse  rounded" />
                <div className="bg-emphasis h-10 w-32 animate-pulse  rounded" />
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="bg-emphasis h-5 w-32 animate-pulse  rounded" />
                <div className="bg-emphasis h-10 w-full animate-pulse  rounded" />
              </div>

              <div className="space-y-4">
                <div className="bg-emphasis h-5 w-48 animate-pulse  rounded" />
                <div className="bg-emphasis h-10 w-full animate-pulse  rounded" />
                <div className="flex items-center space-x-2">
                  <div className="bg-emphasis h-4 w-4 animate-pulse  rounded" />
                  <div className="bg-emphasis h-4 w-40 animate-pulse  rounded" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-emphasis h-5 w-56 animate-pulse  rounded" />
                <div className="bg-emphasis h-10 w-full animate-pulse  rounded" />
              </div>

              <div className="space-y-4">
                <div className="bg-emphasis h-5 w-20 animate-pulse  rounded" />

                {[1, 2].map((index) => (
                  <div key={index} className="border-default relative rounded-lg border p-6">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="bg-emphasis h-4 w-20 animate-pulse  rounded" />
                        <div className="bg-emphasis h-10 w-full animate-pulse  rounded" />
                        <div className="bg-emphasis h-5 w-32 animate-pulse  rounded" />
                        <div className="bg-emphasis h-10 w-full animate-pulse  rounded" />
                        <div className="bg-emphasis h-64 w-full animate-pulse  rounded" />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-emphasis h-12 w-full animate-pulse rounded border-dashed" />
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell withoutMain>
      <div className="bg-default min-h-screen">
        <WorkflowDeleteDialog
          isOpenDialog={confirmationDialogVisible}
          setIsOpenDialog={setConfirmationDialogVisible}
          workflowId={targetWorkflowId}
          additionalFunction={async () => navigationRouter.replace("/workflows")}
        />

        <div className="mx-auto px-6 py-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-emphasis text-2xl font-semibold">{t("workflow_editor")}</h1>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="text-emphasis hover:bg-emphasis "
                onClick={executeWorkflowDeletion}
                disabled={isReadOnlyMode}>
                {t("delete_workflow")}
              </Button>
              <Button
                variant="outline"
                className="text-emphasis hover:bg-emphasis "
                onClick={persistWorkflowChanges}
                disabled={isReadOnlyMode || modificationMutation.isPending}>
                {modificationMutation.isPending ? t("saving_load") : t("save_workflow")}
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="workflow-name" className="text-default text-base font-medium">
                {t("workflow_name")}
              </Label>
              <Controller
                name="name"
                control={formController.control}
                render={({ field }) => (
                  <Input
                    id="workflow-name"
                    {...field}
                    placeholder="Enter workflow name"
                    className="border-default focus:border-gray-900 focus:ring-0"
                    disabled={isReadOnlyMode}
                  />
                )}
              />
              {formController.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500">{formController.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-4">
              <Label className="text-default text-base font-medium">{t("apply_workflow_to")}</Label>

              <Controller
                name="activeOn"
                control={formController.control}
                render={({ field }) => (
                  <MultiSelect
                    options={completeEventTypeList}
                    selected={
                      formController.getValues("selectAll") ? completeEventTypeList : chosenEventTypes
                    }
                    setSelected={processEventTypeChoice}
                    isLoading={loadingEventTypes}
                    isDisabled={isReadOnlyMode}
                    countText="event types"
                    placeholder="Select event types..."
                  />
                )}
              />

              <div className="flex items-center space-x-2">
                <Controller
                  name="selectAll"
                  control={formController.control}
                  render={({ field: { value, onChange } }) => (
                    <Checkbox
                      id="apply-future"
                      checked={value}
                      onCheckedChange={(checked) => {
                        onChange(checked);
                        toggleAllEventTypes(checked as boolean);
                      }}
                      className="border-gray-300"
                      disabled={isReadOnlyMode}
                    />
                  )}
                />
                <Label htmlFor="apply-future" className="text-default text-sm">
                  {t("apply_to_all_event_types")}
                </Label>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-default text-base font-medium">{t("trigger_workflow_when")}</Label>
              <Controller
                name="trigger"
                control={formController.control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={isReadOnlyMode}
                    onValueChange={(value) => {
                      field.onChange(value);
                      modifyTriggerSelection(value as WorkflowTriggerEvents);
                    }}>
                    <SelectTrigger className=" bg-default border-default text-base  focus:ring-0">
                      <SelectValue placeholder="Choose a trigger event" />
                    </SelectTrigger>
                    <SelectContent className="bg-default border-default">
                      {triggerChoices.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {formController.formState.errors.trigger && (
                <p className="mt-1 text-xs text-red-500">{formController.formState.errors.trigger.message}</p>
              )}
            </div>

            {!!schedulingTextDisplay && (
              <div className="space-y-4">
                <Label className="text-default text-base font-medium">{schedulingTextDisplay}</Label>
                <Controller
                  name="time"
                  control={formController.control}
                  render={({ field }) => (
                    <TextField
                      type="number"
                      min="1"
                      disabled={isReadOnlyMode}
                      className="text-sm focus:ring-0"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;

                        const num = Number(val);
                        field.onChange(val === "" ? undefined : num > 0 ? num : 1);
                      }}
                      trailing={
                        <Controller
                          name="timeUnit"
                          control={formController.control}
                          render={({ field: timeUnitField }) => (
                            <Select
                              value={timeUnitField.value}
                              disabled={isReadOnlyMode}
                              onValueChange={(value) => {
                                timeUnitField.onChange(value);
                              }}>
                              <SelectTrigger className="bg-default border-default rounded-none border border-b-0 border-r-0 border-t-0 px-2 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-default">
                                {TIME_UNITS.map((timeUnit) => (
                                  <SelectItem key={timeUnit} value={timeUnit}>
                                    {timeUnitChoices[timeUnit]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      }
                    />
                  )}
                />

                {(formController.formState.errors.time || formController.formState.errors.timeUnit) && (
                  <p className="mt-1 text-xs text-red-500">
                    {formController.formState.errors.time?.message ||
                      formController.formState.errors.timeUnit?.message}
                  </p>
                )}
                <Label className="text-emphasis text-sm">{`*${t("testing_workflow_info_message")}`}</Label>
              </div>
            )}

            <div className="space-y-4">
              <Label className="text-default text-base font-medium">{t("actions")}</Label>

              {observedSteps &&
                observedSteps.map((step, index) => (
                  <WorkflowStepAction
                    key={`${step.id}_${index}`}
                    step={step}
                    index={index}
                    form={formController}
                    readOnly={isReadOnlyMode}
                    actionOptions={availableActions}
                    teamId={associatedTeamId}
                    userTimeFormat={activeUser?.timeFormat ?? undefined}
                    onRemove={eliminateAction}
                  />
                ))}

              {!isReadOnlyMode && (
                <Button
                  variant="outline"
                  onClick={appendAction}
                  className="text-emphasis border-default hover:bg-emphasis w-full border-dashed"
                  disabled={modificationMutation.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("add_action")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default WorkflowEditor;
