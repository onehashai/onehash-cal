import type { WorkflowStep } from "@prisma/client";
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
  const flowIdentifier = props.workflowId;
  const chosenItems = props.selectedOptions;
  const updateChosenItems = props.setSelectedOptions;
  const groupIdentifier = props.teamId;
  const isOrganization = props.isOrg;
  const availableChoices = props.allOptions;

  const localization = useLocale();
  const navigationRouter = useRouter();

  const [actionDialogVisible, changeActionDialogVisibility] = useState<boolean>(false);
  const [refreshRequired, updateRefreshState] = useState<boolean>(false);
  const [removalDialogVisible, setRemovalDialogVisible] = useState<boolean>(false);

  const queryParameters = useSearchParams();
  const eventTypeIdentifier = queryParameters?.get("eventTypeId");

  useEffect(
    function synchronizeEventTypeSelection() {
      const correspondingChoice = availableChoices.find(function (choice) {
        return choice.value === eventTypeIdentifier;
      });

      const alreadySelected = chosenItems.find(function (item) {
        return item.value === eventTypeIdentifier;
      });

      if (correspondingChoice && !alreadySelected) {
        const updatedChoices = [...chosenItems, correspondingChoice];
        updateChosenItems(updatedChoices);
        formInstance.setValue("activeOn", updatedChoices);
      }
    },
    [eventTypeIdentifier]
  );

  const insertNewAction = function (
    actionType: WorkflowActions,
    recipient?: string,
    phoneRequired?: boolean,
    senderIdentity?: string,
    displayName?: string
  ): void {
    const existingSteps = formInstance.getValues("steps");

    const calculateIdentifier = function (): number {
      if (!existingSteps || existingSteps.length === 0) return 0;

      const sortedById = [...existingSteps].sort(function (first, second) {
        return first.id - second.id;
      });

      const minimumId = sortedById[0].id - 1;
      return minimumId > 0 ? 0 : minimumId;
    };

    const determineStepPosition = function (): number {
      if (!existingSteps || existingSteps.length === 0) return 1;

      const sortedByPosition = [...existingSteps].sort(function (first, second) {
        return first.stepNumber - second.stepNumber;
      });

      return sortedByPosition[sortedByPosition.length - 1].stepNumber + 1;
    };

    const constructedStep = {
      id: calculateIdentifier(),
      action: actionType,
      stepNumber: determineStepPosition(),
      sendTo: recipient ?? null,
      workflowId: flowIdentifier,
      reminderBody: null,
      emailSubject: null,
      template: isWhatsappAction(actionType) ? WorkflowTemplates.REMINDER : WorkflowTemplates.CUSTOM,
      numberRequired: phoneRequired ?? false,
      sender: isSMSAction(actionType) ? senderIdentity ?? SENDER_ID : SENDER_ID,
      senderName: !isSMSAction(actionType) ? displayName ?? SENDER_NAME : SENDER_NAME,
      numberVerificationPending: false,
      includeCalendarEvent: false,
      disableOnMarkNoShow: false,
    };

    const modifiedSteps = existingSteps ? [...existingSteps, constructedStep] : [constructedStep];
    formInstance.setValue("steps", modifiedSteps);
  };

  const generateMainContent = function () {
    return (
      <div className="z-1 my-8 sm:my-0 md:flex">
        {renderSidePanel()}
        {renderWorkflowContent()}
      </div>
    );
  };

  const renderSidePanel = function () {
    const isSelectAllActive = formInstance.getValues("selectAll");

    return (
      <div className="pl-2 pr-3 md:sticky md:top-6 md:h-0 md:pl-0">
        <div className="mb-5">
          <TextField
            data-testid="workflow-name"
            disabled={props.readOnly}
            label={`${localization.t("workflow_name")}:`}
            type="text"
            {...formInstance.register("name")}
          />
        </div>

        {renderSelectionLabel()}

        <Controller
          name="activeOn"
          control={formInstance.control}
          render={function () {
            return (
              <MultiSelectCheckboxes
                options={availableChoices}
                isDisabled={props.readOnly || isSelectAllActive}
                className="w-full md:w-64"
                setSelected={updateChosenItems}
                selected={isSelectAllActive ? availableChoices : chosenItems}
                setValue={function (selections: Option[]) {
                  formInstance.setValue("activeOn", selections);
                }}
                countText={isOrganization ? "count_team" : "nr_event_type"}
              />
            );
          }}
        />

        <div className="mt-3">
          <Controller
            name="selectAll"
            render={function ({ field: { value: isChecked, onChange: handleChange } }) {
              return (
                <CheckboxField
                  description={
                    isOrganization
                      ? localization.t("apply_to_all_teams")
                      : localization.t("apply_to_all_event_types")
                  }
                  disabled={props.readOnly}
                  onChange={function (event) {
                    handleChange(event);
                    if (event.target.value) {
                      updateChosenItems(availableChoices);
                      formInstance.setValue("activeOn", availableChoices);
                    }
                  }}
                  checked={isChecked}
                />
              );
            }}
          />
        </div>

        <div className="md:border-subtle my-7 border-transparent md:border-t" />

        {!props.readOnly && (
          <Button
            type="button"
            StartIcon="trash-2"
            color="destructive"
            className="border"
            onClick={function () {
              setRemovalDialogVisible(true);
            }}>
            {localization.t("delete_workflow")}
          </Button>
        )}

        <div className="border-subtle my-7 border-t md:border-none" />
      </div>
    );
  };

  const renderSelectionLabel = function () {
    if (isOrganization) {
      return (
        <div className="flex">
          <Label>{localization.t("which_team_apply")}</Label>
          <div className="-mt-0.5">
            <InfoBadge content={localization.t("team_select_info")} />
          </div>
        </div>
      );
    }

    return <Label>{localization.t("which_event_type_apply")}</Label>;
  };

  const renderWorkflowContent = function () {
    const triggerData = formInstance.getValues("trigger");
    const stepData = formInstance.getValues("steps");

    return (
      <div className="bg-muted border-subtle w-full rounded-md border p-3 py-5 md:ml-3 md:p-8">
        {triggerData && (
          <div>
            <WorkflowStepContainer
              form={formInstance}
              user={props.user}
              teamId={groupIdentifier}
              readOnly={props.readOnly}
            />
          </div>
        )}

        {stepData && renderStepList(stepData)}

        {!props.readOnly && renderActionControls()}
      </div>
    );
  };
  type StepDataType = FormValues["steps"];

  const renderStepList = function (stepCollection: StepDataType) {
    return (
      <>
        {stepCollection?.map(function (individualStep: WorkflowStep) {
          return (
            <WorkflowStepContainer
              key={individualStep.id}
              form={formInstance}
              user={props.user}
              step={individualStep}
              reload={refreshRequired}
              setReload={updateRefreshState}
              teamId={groupIdentifier}
              readOnly={props.readOnly}
            />
          );
        })}
      </>
    );
  };

  const renderActionControls = function () {
    return (
      <>
        <div className="my-3 flex justify-center">
          <Icon name="arrow-down" className="text-subtle stroke-[1.5px] text-3xl" />
        </div>
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={function () {
              changeActionDialogVisibility(true);
            }}
            color="secondary"
            className="bg-default">
            {localization.t("add_action")}
          </Button>
        </div>
      </>
    );
  };

  return (
    <>
      {generateMainContent()}

      <AddActionDialog
        isOpenDialog={actionDialogVisible}
        setIsOpenDialog={changeActionDialogVisibility}
        addAction={insertNewAction}
      />

      <DeleteDialog
        isOpenDialog={removalDialogVisible}
        setIsOpenDialog={setRemovalDialogVisible}
        workflowId={flowIdentifier}
        additionalFunction={async function () {
          await navigationRouter.push("/workflows");
        }}
      />
    </>
  );
}
