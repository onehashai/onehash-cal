"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { WorkflowStep } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import LicenseRequired from "@calcom/features/oe/common/components/LicenseRequired";
import Shell, { ShellMain } from "@calcom/features/shell/Shell";
import { classNames } from "@calcom/lib";
import { SENDER_ID } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { HttpError } from "@calcom/lib/http-error";
import type { WorkflowRepository } from "@calcom/lib/server/repository/workflow";
import type { TimeUnit, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { MembershipRole, WorkflowActions } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import type { MultiSelectCheckboxesOptionType as Option } from "@calcom/ui";
import { Alert, Badge, Button, Form, showToast } from "@calcom/ui";

import SkeletonLoader from "../components/SkeletonLoaderEdit";
import WorkflowDetailsPage from "../components/WorkflowDetailsPage";
import { isSMSAction, isSMSOrWhatsappAction } from "../lib/actionHelperFunctions";
import { formSchema, querySchema } from "../lib/schema";
import { getTranslatedText, translateVariablesToEnglish } from "../lib/variableTranslations";

export type FormValues = {
  name: string;
  activeOn: Option[];
  steps: (WorkflowStep & { senderName: string | null })[];
  trigger: WorkflowTriggerEvents;
  time?: number;
  timeUnit?: TimeUnit;
  selectAll: boolean;
};

type PageProps = {
  workflowData?: Awaited<ReturnType<typeof WorkflowRepository.getById>>;
  verifiedNumbers?: Awaited<ReturnType<typeof WorkflowRepository.getVerifiedNumbers>>;
  verifiedEmails?: Awaited<ReturnType<typeof WorkflowRepository.getVerifiedEmails>>;
};

const WorkflowPage = ({
  workflowData: initialWorkflowData,
  verifiedNumbers: initialVerifiedNumbers,
  verifiedEmails: initialVerifiedEmails,
}: PageProps) => {
  const { t, i18n } = useLocale();
  const sessionData = useSession();
  const urlParams = useParamsWithFallback();

  const [currentOptions, setCurrentOptions] = useState<Option[]>([]);
  const [hasLoadedAllData, setHasLoadedAllData] = useState(false);
  const [containsMixedTypes, setContainsMixedTypes] = useState(false);

  const formController = useForm<FormValues>({
    mode: "onBlur",
    resolver: zodResolver(formSchema),
  });

  const { workflow: currentWorkflowId } = urlParams ? querySchema.parse(urlParams) : { workflow: -1 };
  const trpcUtils = trpc.useUtils();

  const currentUserQuery = useMeQuery();
  const currentUser = currentUserQuery.data;

  const {
    data: fetchedWorkflow,
    isError: hasFetchError,
    error: fetchError,
    isPending: isWorkflowLoading,
  } = trpc.viewer.workflows.get.useQuery(
    { id: +currentWorkflowId },
    {
      enabled: initialWorkflowData ? false : !!currentWorkflowId,
    }
  );

  const workflowEntity = initialWorkflowData || fetchedWorkflow;
  const isLoadingWorkflow = initialWorkflowData ? false : isWorkflowLoading;
  const hasError = initialWorkflowData ? false : hasFetchError;

  const { data: fetchedPhoneNumbers } = trpc.viewer.workflows.getVerifiedNumbers.useQuery(
    { teamId: workflowEntity?.team?.id },
    {
      enabled: initialVerifiedNumbers ? false : !!workflowEntity?.id,
    }
  );
  const phoneNumbers = initialVerifiedNumbers || fetchedPhoneNumbers;

  const { data: fetchedEmailAddresses } = trpc.viewer.workflows.getVerifiedEmails.useQuery(
    {
      teamId: workflowEntity?.team?.id,
    },
    { enabled: !initialVerifiedEmails }
  );
  const emailAddresses = initialVerifiedEmails || fetchedEmailAddresses;

  const isOrganization = workflowEntity?.team?.isOrganization ?? false;

  const associatedTeamId = workflowEntity?.teamId ?? undefined;

  const { data: typeOptions, isPending: isLoadingEventTypes } =
    trpc.viewer.eventTypes.getTeamAndEventTypeOptions.useQuery(
      { teamId: associatedTeamId, isOrg: isOrganization },
      { enabled: !isLoadingWorkflow }
    );

  const availableTeams = typeOptions?.teamOptions ?? [];

  let availableEventTypes = typeOptions?.eventTypeOptions ?? [];
  const uniqueEventTypes = new Set();

  if (!associatedTeamId && containsMixedTypes) {
    availableEventTypes = [...availableEventTypes, ...currentOptions];
    availableEventTypes = availableEventTypes.filter((eventType) => {
      const isDuplicate = uniqueEventTypes.has(eventType.value);
      uniqueEventTypes.add(eventType.value);
      return !isDuplicate;
    });
  }

  const isReadOnlyMode =
    workflowEntity?.team?.members?.find((member) => member.userId === sessionData.data?.user.id)?.role ===
    MembershipRole.MEMBER;

  const isDataLoading = isLoadingWorkflow || isLoadingEventTypes;

  useEffect(() => {
    if (!isDataLoading) {
      populateFormData(workflowEntity);
    }
  }, [isDataLoading]);

  const populateFormData = (workflow: RouterOutputs["viewer"]["workflows"]["get"] | undefined) => {
    if (!workflow) return;

    if (workflow.userId && workflow.activeOn.find((activeItem) => !!activeItem.eventType.teamId)) {
      setContainsMixedTypes(true);
    }

    let selectedEventTypes;

    if (workflow.isActiveOnAll) {
      selectedEventTypes = isOrganization ? availableTeams : availableEventTypes;
    } else {
      if (isOrganization) {
        selectedEventTypes = workflow.activeOnTeams.flatMap((activeTeam) => ({
          value: String(activeTeam.team.id) || "",
          label: activeTeam.team.slug || "",
        }));
        setCurrentOptions(selectedEventTypes || []);
      } else {
        setCurrentOptions(
          workflow.activeOn?.flatMap((activeItem) => {
            if (workflow.teamId && activeItem.eventType.parentId) return [];
            return {
              value: String(activeItem.eventType.id),
              label: activeItem.eventType.title,
            };
          }) || []
        );
        selectedEventTypes = workflow.activeOn
          ? workflow.activeOn.map((activeItem) => ({
              value: activeItem.eventType.id.toString(),
              label: activeItem.eventType.slug,
            }))
          : undefined;
      }
    }

    const processedSteps = workflow.steps?.map((stepItem) => {
      const modifiedStep = {
        ...stepItem,
        senderName: stepItem.sender,
        sender: isSMSAction(stepItem.action) ? stepItem.sender : SENDER_ID,
      };
      if (stepItem.reminderBody) {
        modifiedStep.reminderBody = getTranslatedText(stepItem.reminderBody || "", {
          locale: i18n.language,
          t,
        });
      }
      if (stepItem.emailSubject) {
        modifiedStep.emailSubject = getTranslatedText(stepItem.emailSubject || "", {
          locale: i18n.language,
          t,
        });
      }
      return modifiedStep;
    });

    formController.setValue("name", workflow.name);
    formController.setValue("steps", processedSteps);
    formController.setValue("trigger", workflow.trigger);
    formController.setValue("time", workflow.time || undefined);
    formController.setValue("timeUnit", workflow.timeUnit || undefined);
    formController.setValue("activeOn", selectedEventTypes || []);
    formController.setValue("selectAll", workflow.isActiveOnAll ?? false);
    setHasLoadedAllData(true);
  };

  const modifyWorkflowMutation = trpc.viewer.workflows.update.useMutation({
    onSuccess: async ({ workflow: updatedWorkflow }) => {
      if (updatedWorkflow) {
        trpcUtils.viewer.workflows.get.setData({ id: +updatedWorkflow.id }, updatedWorkflow);
        populateFormData(updatedWorkflow);
        showToast(
          t("workflow_updated_successfully", {
            workflowName: updatedWorkflow.name,
          }),
          "success"
        );
      }
    },
    onError: (error) => {
      if (error instanceof HttpError) {
        const errorMessage = `${error.statusCode}: ${error.message}`;
        showToast(errorMessage, "error");
      }
    },
  });

  const processFormSubmission = async (formData: FormValues) => {
    let selectedIds: number[] = [];
    let hasEmptyContent = false;
    let hasVerifiedContacts = true;

    formData.steps.forEach((stepData) => {
      const cleanedContent = stepData.reminderBody?.replace(/<[^>]+>/g, "") || "";
      const isContentEmpty = !isSMSOrWhatsappAction(stepData.action) && cleanedContent.length <= 1;

      if (isContentEmpty) {
        formController.setError(`steps.${stepData.stepNumber - 1}.reminderBody`, {
          type: "custom",
          message: t("fill_this_field"),
        });
      }

      if (stepData.reminderBody) {
        stepData.reminderBody = translateVariablesToEnglish(stepData.reminderBody, {
          locale: i18n.language,
          t,
        });
      }
      if (stepData.emailSubject) {
        stepData.emailSubject = translateVariablesToEnglish(stepData.emailSubject, {
          locale: i18n.language,
          t,
        });
      }
      hasEmptyContent = !hasEmptyContent ? isContentEmpty : hasEmptyContent;

      if (
        (stepData.action === WorkflowActions.SMS_NUMBER ||
          stepData.action === WorkflowActions.WHATSAPP_NUMBER) &&
        !phoneNumbers?.find((verifiedPhone) => verifiedPhone.phoneNumber === stepData.sendTo)
      ) {
        hasVerifiedContacts = false;
        formController.setError(`steps.${stepData.stepNumber - 1}.sendTo`, {
          type: "custom",
          message: t("not_verified"),
        });
      }

      if (
        stepData.action === WorkflowActions.EMAIL_ADDRESS &&
        !emailAddresses?.find((verifiedEmail) => verifiedEmail === stepData.sendTo)
      ) {
        hasVerifiedContacts = false;
        formController.setError(`steps.${stepData.stepNumber - 1}.sendTo`, {
          type: "custom",
          message: t("not_verified"),
        });
      }
    });

    if (!hasEmptyContent && hasVerifiedContacts) {
      if (formData.activeOn) {
        selectedIds = formData.activeOn
          .filter((optionItem) => optionItem.value !== "all")
          .map((optionItem) => parseInt(optionItem.value, 10));
      }
      modifyWorkflowMutation.mutate({
        id: currentWorkflowId,
        name: formData.name,
        activeOn: selectedIds,
        steps: formData.steps,
        trigger: formData.trigger,
        time: formData.time || null,
        timeUnit: formData.timeUnit || null,
        isActiveOnAll: formData.selectAll || false,
      });
      trpcUtils.viewer.workflows.getVerifiedNumbers.invalidate();
    }
  };

  const renderWorkflowContent = () => {
    if (hasError) {
      return <Alert severity="error" title="Something went wrong" message={fetchError?.message ?? ""} />;
    }

    if (hasLoadedAllData && currentUser) {
      return (
        <WorkflowDetailsPage
          form={formController}
          workflowId={+currentWorkflowId}
          user={currentUser}
          selectedOptions={currentOptions}
          setSelectedOptions={setCurrentOptions}
          teamId={workflowEntity ? workflowEntity.teamId || undefined : undefined}
          readOnly={isReadOnlyMode}
          isOrg={isOrganization}
          allOptions={isOrganization ? availableTeams : availableEventTypes}
        />
      );
    }

    return <SkeletonLoader />;
  };

  const generateWorkflowTitle = () => {
    return workflowEntity && workflowEntity.name ? workflowEntity.name : "Untitled";
  };

  const generateWorkflowHeading = () => {
    if (!hasLoadedAllData) return null;

    return (
      <div className="flex">
        <div className={classNames(workflowEntity && !workflowEntity.name ? "text-muted" : "")}>
          {workflowEntity && workflowEntity.name ? workflowEntity.name : "untitled"}
        </div>
        {workflowEntity && workflowEntity.team && (
          <Badge className="ml-4 mt-1" variant="gray">
            {workflowEntity.team.name}
          </Badge>
        )}
        {isReadOnlyMode && (
          <Badge className="ml-4 mt-1" variant="gray">
            {t("readonly")}
          </Badge>
        )}
      </div>
    );
  };

  const generateActionButton = () => {
    if (isReadOnlyMode) return null;

    return (
      <div>
        <Button data-testid="save-workflow" type="submit" loading={modifyWorkflowMutation.isPending}>
          {t("save")}
        </Button>
      </div>
    );
  };

  if (!sessionData.data) {
    return <></>;
  }

  return (
    <Shell withoutMain backPath="/workflows">
      <LicenseRequired>
        <Form form={formController} handleSubmit={processFormSubmission}>
          <ShellMain
            backPath="/workflows"
            title={generateWorkflowTitle()}
            CTA={generateActionButton()}
            hideHeadingOnMobile
            heading={generateWorkflowHeading()}>
            {renderWorkflowContent()}
          </ShellMain>
        </Form>
      </LicenseRequired>
    </Shell>
  );
};

export default WorkflowPage;
