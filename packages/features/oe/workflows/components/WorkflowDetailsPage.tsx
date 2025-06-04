import { useRouter, useSearchParams } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";

import { SENDER_ID, SENDER_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { WorkflowActions } from "@calcom/prisma/enums";
import { WorkflowTemplates } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import type { MultiSelectCheckboxesOptionType as Option } from "@calcom/ui";
import { Button, Icon, Label, MultiSelectCheckboxes, TextField, CheckboxField, InfoBadge } from "@calcom/ui";

import { isSMSAction, isWhatsappAction } from "../lib/actionHelperFunctions";
import type { FormValues } from "../pages/workflow";
import { AddActionDialog } from "./AddActionDialog";
import { DeleteDialog } from "./DeleteDialog";
import WorkflowStepContainer from "./WorkflowStepContainer";

type User = RouterOutputs["viewer"]["me"];

interface Props {
  form: UseFormReturn<FormValues>;
  workflowId: number;
  selectedOptions: Option[];
  setSelectedOptions: Dispatch<SetStateAction<Option[]>>;
  teamId?: number;
  user: User;
  readOnly: boolean;
  isOrg: boolean;
  allOptions: Option[];
}

export default function WorkflowDetailsPage(props: Props) {
  const formInstance = props.form;
  const workflowIdentifier = props.workflowId;
  const currentSelectedOptions = props.selectedOptions;
  const updateSelectedOptions = props.setSelectedOptions;
  const teamIdentifier = props.teamId;
  const organizationMode = props.isOrg;
  const availableOptions = props.allOptions;
  const userInfo = props.user;
  const viewOnlyMode = props.readOnly;

  const localeHook = useLocale();
  const translate = localeHook.t;
  const navigationRouter = useRouter();

  const actionDialogState = useState(false);
  const reloadState = useState(false);
  const deleteDialogState = useState(false);

  const [actionDialogVisible, setActionDialogVisible] = actionDialogState;
  const [shouldReload, setShouldReload] = reloadState;
  const [deleteDialogVisible, setDeleteDialogVisible] = deleteDialogState;

  const queryParams = useSearchParams();
  const targetEventTypeId = queryParams?.get("eventTypeId");

  useEffect(() => {
    const findMatchingOption = () => {
      return availableOptions.find((opt) => opt.value === targetEventTypeId);
    };

    const isOptionAlreadySelected = () => {
      return currentSelectedOptions.find((opt) => opt.value === targetEventTypeId);
    };

    const matchedOption = findMatchingOption();

    if (matchedOption && !isOptionAlreadySelected()) {
      const updatedOptions = [...currentSelectedOptions, matchedOption];
      updateSelectedOptions(updatedOptions);
      formInstance.setValue("activeOn", updatedOptions);
    }
  }, [targetEventTypeId]);

  const handleActionAddition = (
    action: WorkflowActions,
    sendTo?: string,
    numberRequired?: boolean,
    sender?: string,
    senderName?: string
  ) => {
    const existingSteps = formInstance.getValues("steps");

    const calculateNewId = () => {
      if (!existingSteps || existingSteps.length === 0) return 0;

      const sortedById = [...existingSteps].sort((stepA, stepB) => stepA.id - stepB.id);
      const lowestId = sortedById[0].id;
      return lowestId > 0 ? 0 : lowestId - 1;
    };

    const calculateStepNumber = () => {
      if (!existingSteps || existingSteps.length === 0) return 1;

      const sortedByStepNumber = [...existingSteps].sort(
        (stepA, stepB) => stepA.stepNumber - stepB.stepNumber
      );
      const highestStepNumber = sortedByStepNumber[sortedByStepNumber.length - 1].stepNumber;
      return highestStepNumber + 1;
    };

    const determineSender = () => {
      if (isSMSAction(action)) {
        return sender || SENDER_ID;
      }
      return SENDER_ID;
    };

    const determineSenderName = () => {
      if (!isSMSAction(action)) {
        return senderName || SENDER_NAME;
      }
      return SENDER_NAME;
    };

    const determineTemplate = () => {
      return isWhatsappAction(action) ? WorkflowTemplates.REMINDER : WorkflowTemplates.CUSTOM;
    };

    const newStep = {
      id: calculateNewId(),
      action,
      stepNumber: calculateStepNumber(),
      sendTo: sendTo || null,
      workflowId: workflowIdentifier,
      reminderBody: null,
      emailSubject: null,
      template: determineTemplate(),
      numberRequired: numberRequired || false,
      sender: determineSender(),
      senderName: determineSenderName(),
      numberVerificationPending: false,
      includeCalendarEvent: false,
      disableOnMarkNoShow: false,
    };

    const updatedSteps = [...(existingSteps || []), newStep];
    formInstance.setValue("steps", updatedSteps);
  };

  const navigateToWorkflows = async () => {
    await navigationRouter.push("/workflows");
  };

  const SidebarSection = () => {
    const sidebarClasses = "pl-2 pr-3 md:sticky md:top-6 md:h-0 md:pl-0";
    const nameFieldClasses = "mb-5";
    const dividerClasses = "md:border-subtle my-7 border-transparent md:border-t";
    const bottomDividerClasses = "border-subtle my-7 border-t md:border-none";

    const TeamOrgLabel = () => {
      if (organizationMode) {
        return (
          <div className="flex">
            <Label>{translate("which_team_apply")}</Label>
            <div className="-mt-0.5">
              <InfoBadge content={translate("team_select_info")} />
            </div>
          </div>
        );
      }
      return <Label>{translate("which_event_type_apply")}</Label>;
    };

    const DeleteWorkflowButton = () => {
      if (viewOnlyMode) return null;

      return (
        <Button
          type="button"
          StartIcon="trash-2"
          color="destructive"
          className="border"
          onClick={() => setDeleteDialogVisible(true)}>
          {translate("delete_workflow")}
        </Button>
      );
    };

    return (
      <div className={sidebarClasses}>
        <div className={nameFieldClasses}>
          <TextField
            data-testid="workflow-name"
            disabled={viewOnlyMode}
            label={`${translate("workflow_name")}:`}
            type="text"
            {...formInstance.register("name")}
          />
        </div>
        <TeamOrgLabel />
        <Controller
          name="activeOn"
          control={formInstance.control}
          render={() => {
            const selectAllEnabled = formInstance.getValues("selectAll");
            const selectedValues = selectAllEnabled ? availableOptions : currentSelectedOptions;

            return (
              <MultiSelectCheckboxes
                options={availableOptions}
                isDisabled={viewOnlyMode || selectAllEnabled}
                className="w-full md:w-64"
                setSelected={updateSelectedOptions}
                selected={selectedValues}
                setValue={(selections: Option[]) => {
                  formInstance.setValue("activeOn", selections);
                }}
                countText={organizationMode ? "count_team" : "nr_event_type"}
              />
            );
          }}
        />
        <div className="mt-3">
          <Controller
            name="selectAll"
            render={({ field: { value, onChange } }) => {
              const handleSelectAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                onChange(event);
                if (event.target.value) {
                  updateSelectedOptions(availableOptions);
                  formInstance.setValue("activeOn", availableOptions);
                }
              };

              return (
                <CheckboxField
                  description={
                    organizationMode ? translate("apply_to_all_teams") : translate("apply_to_all_event_types")
                  }
                  disabled={viewOnlyMode}
                  onChange={handleSelectAllChange}
                  checked={value}
                />
              );
            }}
          />
        </div>
        <div className={dividerClasses} />
        <DeleteWorkflowButton />
        <div className={bottomDividerClasses} />
      </div>
    );
  };

  const WorkflowContentSection = () => {
    const contentClasses = "bg-muted border-subtle w-full rounded-md border p-3 py-5 md:ml-3 md:p-8";
    const arrowContainerClasses = "my-3 flex justify-center";
    const arrowClasses = "text-subtle stroke-[1.5px] text-3xl";
    const buttonContainerClasses = "flex justify-center";
    const addButtonClasses = "bg-default";

    const TriggerStep = () => {
      const triggerData = formInstance.getValues("trigger");
      if (!triggerData) return null;

      return (
        <div>
          <WorkflowStepContainer
            form={formInstance}
            user={userInfo}
            teamId={teamIdentifier}
            readOnly={viewOnlyMode}
          />
        </div>
      );
    };

    const WorkflowSteps = () => {
      const stepsData = formInstance.getValues("steps");
      if (!stepsData) return null;

      return (
        <>
          {stepsData.map((stepData) => (
            <WorkflowStepContainer
              key={stepData.id}
              form={formInstance}
              user={userInfo}
              step={stepData}
              reload={shouldReload}
              setReload={setShouldReload}
              teamId={teamIdentifier}
              readOnly={viewOnlyMode}
            />
          ))}
        </>
      );
    };

    const AddActionSection = () => {
      if (viewOnlyMode) return null;

      return (
        <>
          <div className={arrowContainerClasses}>
            <Icon name="arrow-down" className={arrowClasses} />
          </div>
          <div className={buttonContainerClasses}>
            <Button
              type="button"
              onClick={() => setActionDialogVisible(true)}
              color="secondary"
              className={addButtonClasses}>
              {translate("add_action")}
            </Button>
          </div>
        </>
      );
    };

    return (
      <div className={contentClasses}>
        <TriggerStep />
        <WorkflowSteps />
        <AddActionSection />
      </div>
    );
  };

  const mainContainerClasses = "z-1 my-8 sm:my-0 md:flex";

  return (
    <>
      <div className={mainContainerClasses}>
        <SidebarSection />
        <WorkflowContentSection />
      </div>
      <AddActionDialog
        isOpenDialog={actionDialogVisible}
        setIsOpenDialog={setActionDialogVisible}
        addAction={handleActionAddition}
      />
      <DeleteDialog
        isOpenDialog={deleteDialogVisible}
        setIsOpenDialog={setDeleteDialogVisible}
        workflowId={workflowIdentifier}
        additionalFunction={navigateToWorkflows}
      />
    </>
  );
}
