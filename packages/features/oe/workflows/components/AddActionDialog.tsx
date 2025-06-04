import { zodResolver } from "@hookform/resolvers/zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { SENDER_ID, SENDER_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { WorkflowActions } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import {
  Button,
  CheckboxField,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  EmailField,
  Form,
  Icon,
  Input,
  Label,
  PhoneInput,
  Select,
  Tooltip,
} from "@calcom/ui";

import { WORKFLOW_ACTIONS } from "../lib/constants";
import { onlyLettersNumbersSpaces } from "../lib/schema";

interface IAddActionDialog {
  isOpenDialog: boolean;
  setIsOpenDialog: Dispatch<SetStateAction<boolean>>;
  addAction: (
    action: WorkflowActions,
    sendTo?: string,
    numberRequired?: boolean,
    senderId?: string,
    senderName?: string
  ) => void;
}

interface ISelectActionOption {
  label: string;
  value: WorkflowActions;
}

type AddActionFormValues = {
  action: WorkflowActions;
  sendTo?: string;
  numberRequired?: boolean;
  senderId?: string;
  senderName?: string;
};

export const AddActionDialog = (props: IAddActionDialog) => {
  const localeHook = useLocale();
  const translationFunc = localeHook.t;
  const dialogState = props.isOpenDialog;
  const updateDialogState = props.setIsOpenDialog;
  const actionHandler = props.addAction;

  const phoneInputVisible = useState(false);
  const senderFieldVisible = useState(false);
  const emailFieldVisible = useState(false);

  const [requiresPhone, updatePhoneRequirement] = phoneInputVisible;
  const [requiresSender, updateSenderRequirement] = senderFieldVisible;
  const [requiresEmail, updateEmailRequirement] = emailFieldVisible;

  const workflowOptionsQuery = trpc.viewer.workflows.getWorkflowActionOptions.useQuery();
  const availableActions = workflowOptionsQuery.data;

  const validationSchema = z.object({
    action: z.enum(WORKFLOW_ACTIONS),
    sendTo: z
      .string()
      .refine((input) => isValidPhoneNumber(input) || input.includes("@"))
      .optional(),
    numberRequired: z.boolean().optional(),
    senderId: z
      .string()
      .refine((input) => onlyLettersNumbersSpaces(input))
      .nullable(),
    senderName: z.string().nullable(),
  });

  const formInstance = useForm<AddActionFormValues>({
    mode: "onSubmit",
    defaultValues: {
      action: WorkflowActions.EMAIL_HOST,
      senderId: SENDER_ID,
      senderName: SENDER_NAME,
    },
    resolver: zodResolver(validationSchema),
  });

  const actionSelectionHandler = (selectedOption: ISelectActionOption | null) => {
    if (!selectedOption) return;

    const selectedValue = selectedOption.value;
    formInstance.setValue("action", selectedValue);

    const resetFields = () => {
      formInstance.unregister("sendTo");
      formInstance.unregister("numberRequired");
      formInstance.clearErrors("action");
      formInstance.clearErrors("sendTo");
    };

    switch (selectedValue) {
      case WorkflowActions.SMS_NUMBER:
        updatePhoneRequirement(true);
        updateSenderRequirement(true);
        updateEmailRequirement(false);
        formInstance.resetField("senderId", { defaultValue: SENDER_ID });
        break;
      case WorkflowActions.EMAIL_ADDRESS:
        updateEmailRequirement(true);
        updateSenderRequirement(false);
        updatePhoneRequirement(false);
        break;
      case WorkflowActions.SMS_ATTENDEE:
        updateSenderRequirement(true);
        updateEmailRequirement(false);
        updatePhoneRequirement(false);
        formInstance.resetField("senderId", { defaultValue: SENDER_ID });
        break;
      case WorkflowActions.WHATSAPP_NUMBER:
        updateSenderRequirement(false);
        updatePhoneRequirement(true);
        updateEmailRequirement(false);
        break;
      default:
        updateSenderRequirement(false);
        updateEmailRequirement(false);
        updatePhoneRequirement(false);
    }

    resetFields();
  };

  if (!availableActions) return null;

  const phoneNumberCanBeRequired = (stepType: WorkflowActions) => {
    const allowedSteps: WorkflowActions[] = [WorkflowActions.SMS_ATTENDEE, WorkflowActions.WHATSAPP_ATTENDEE];
    return allowedSteps.includes(stepType);
  };

  const senderFieldShouldDisplay = (actionType: string) => {
    const whatsappActions: WorkflowActions[] = [
      WorkflowActions.WHATSAPP_NUMBER,
      WorkflowActions.WHATSAPP_ATTENDEE,
    ];
    return !requiresSender && !whatsappActions.includes(actionType as WorkflowActions);
  };

  const submissionHandler = (formData: AddActionFormValues) => {
    actionHandler(
      formData.action,
      formData.sendTo,
      formData.numberRequired,
      formData.senderId,
      formData.senderName
    );

    const cleanupForm = () => {
      formInstance.unregister("sendTo");
      formInstance.unregister("action");
      formInstance.unregister("numberRequired");
      updateDialogState(false);
      updatePhoneRequirement(false);
      updateEmailRequirement(false);
      updateSenderRequirement(false);
    };

    cleanupForm();
  };

  const closeHandler = () => {
    updateDialogState(false);
    formInstance.unregister("sendTo");
    formInstance.unregister("action");
    formInstance.unregister("numberRequired");
    updatePhoneRequirement(false);
    updateEmailRequirement(false);
    updateSenderRequirement(false);
  };

  const PhoneNumberSection = () => (
    <div className="mt-5 space-y-1">
      <Label htmlFor="sendTo">{translationFunc("phone_number")}</Label>
      <div className="mb-5 mt-1">
        <Controller
          control={formInstance.control}
          name="sendTo"
          render={({ field: { value, onChange } }) => (
            <PhoneInput
              className="rounded-md"
              placeholder={translationFunc("enter_phone_number")}
              id="sendTo"
              required
              value={value}
              onChange={onChange}
            />
          )}
        />
        {formInstance.formState.errors.sendTo && (
          <p className="mt-1 text-sm text-red-500">{formInstance.formState.errors.sendTo.message}</p>
        )}
      </div>
    </div>
  );

  const EmailSection = () => (
    <div className="mt-5">
      <EmailField required label={translationFunc("email_address")} {...formInstance.register("sendTo")} />
    </div>
  );

  const SenderIdSection = () => (
    <>
      <div className="mt-5">
        <div className="flex items-center">
          <Label>{translationFunc("sender_id")}</Label>
          <Tooltip content={translationFunc("sender_id_info")}>
            <span>
              <Icon name="info" className="mb-2 ml-2 mr-1 mt-0.5 h-4 w-4 text-gray-500" />
            </span>
          </Tooltip>
        </div>
        <Input type="text" placeholder={SENDER_ID} maxLength={11} {...formInstance.register(`senderId`)} />
      </div>
      {formInstance.formState.errors?.senderId && (
        <p className="mt-1 text-xs text-red-500">{translationFunc("sender_id_error_message")}</p>
      )}
    </>
  );

  const SenderNameSection = () => (
    <div className="mt-5">
      <Label>{translationFunc("sender_name")}</Label>
      <Input type="text" placeholder={SENDER_NAME} {...formInstance.register(`senderName`)} />
    </div>
  );

  const PhoneRequirementSection = () => (
    <div className="mt-5">
      <Controller
        name="numberRequired"
        control={formInstance.control}
        render={() => (
          <CheckboxField
            defaultChecked={formInstance.getValues("numberRequired") || false}
            description={translationFunc("make_phone_number_required")}
            onChange={(e) => formInstance.setValue("numberRequired", e.target.checked)}
          />
        )}
      />
    </div>
  );

  return (
    <Dialog open={dialogState} onOpenChange={updateDialogState}>
      <DialogContent enableOverflow type="creation" title={translationFunc("add_action")}>
        <div className="-mt-3 space-x-3">
          <Form form={formInstance} handleSubmit={submissionHandler}>
            <div className="space-y-1">
              <Label htmlFor="label">{translationFunc("action")}:</Label>
              <Controller
                name="action"
                control={formInstance.control}
                render={() => {
                  const selectOptions = availableActions.map((opt) => ({ ...opt }));
                  const isDisabled = (opt: {
                    label: string;
                    value: WorkflowActions;
                    needsTeamsUpgrade: boolean;
                  }) => opt.needsTeamsUpgrade;

                  return (
                    <Select
                      isSearchable={false}
                      className="text-sm"
                      menuPlacement="bottom"
                      defaultValue={availableActions[0]}
                      onChange={actionSelectionHandler}
                      options={selectOptions}
                      isOptionDisabled={isDisabled}
                    />
                  );
                }}
              />
              {formInstance.formState.errors.action && (
                <p className="mt-1 text-sm text-red-500">{formInstance.formState.errors.action.message}</p>
              )}
            </div>
            {requiresPhone && <PhoneNumberSection />}
            {requiresEmail && <EmailSection />}
            {requiresSender && <SenderIdSection />}
            {senderFieldShouldDisplay(formInstance.getValues("action")) && <SenderNameSection />}
            {phoneNumberCanBeRequired(formInstance.getValues("action")) && <PhoneRequirementSection />}
            <DialogFooter showDivider className="mt-12">
              <DialogClose onClick={closeHandler} />
              <Button type="submit">{translationFunc("add")}</Button>
            </DialogFooter>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
