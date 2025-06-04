import { useRouter } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import type { IconName } from "@calcom/ui";
import { CreateButtonWithTeamsList, EmptyScreen as ClassicEmptyScreen, Icon, showToast } from "@calcom/ui";

type WorkflowExampleType = {
  Icon: IconName;
  text: string;
};

function WorkflowExample(props: WorkflowExampleType) {
  const iconType = props.Icon;
  const displayText = props.text;

  const containerStyles = "border-subtle mx-2 my-2 max-h-24 max-w-[600px] rounded-md border border-solid p-6";
  const wrapperStyles = "flex ";
  const iconContainerStyles = "flex items-center justify-center";
  const iconBackgroundStyles =
    "bg-emphasis dark:bg-default mr-4 flex h-10 w-10 items-center justify-center rounded-full";
  const iconStyles = "text-default h-6 w-6 stroke-[2px]";
  const textContainerStyles = "m-auto w-full flex-grow items-center justify-center ";
  const textStyles = "text-semibold text-emphasis line-clamp-2 w-full text-sm font-medium";

  return (
    <div className={containerStyles}>
      <div className={wrapperStyles}>
        <div className={iconContainerStyles}>
          <div className={iconBackgroundStyles}>
            <Icon name={iconType} className={iconStyles} />
          </div>
        </div>
        <div className={textContainerStyles}>
          <div className={textStyles}>{displayText}</div>
        </div>
      </div>
    </div>
  );
}

export default function EmptyScreen(props: { isFilteredView: boolean; onlyExample?: boolean }) {
  const localeData = useLocale();
  const getTranslation = localeData.t;
  const filteredViewState = props.isFilteredView;
  const exampleOnlyMode = props.onlyExample ?? false;
  const navigationRouter = useRouter();

  const workflowCreationMutation = trpc.viewer.workflows.create.useMutation({
    onSuccess: async (result) => {
      const createdWorkflow = result.workflow;
      const targetUrl = `/workflows/${createdWorkflow.id}`;
      await navigationRouter.replace(targetUrl);
    },
    onError: (error) => {
      const processHttpError = () => {
        if (!(error instanceof HttpError)) return;
        const httpErrorMessage = `${error.statusCode}: ${error.message}`;
        showToast(httpErrorMessage, "error");
      };

      const processAuthError = () => {
        const errorCode = error.data?.code;
        if (errorCode !== "UNAUTHORIZED") return;
        const authErrorMessage = `${errorCode}: You are not authorized to create this workflow`;
        showToast(authErrorMessage, "error");
      };

      processHttpError();
      processAuthError();
    },
  });

  const exampleData = [
    { icon: "smartphone" as const, text: getTranslation("workflow_example_1") },
    { icon: "smartphone" as const, text: getTranslation("workflow_example_2") },
    { icon: "mail" as const, text: getTranslation("workflow_example_3") },
    { icon: "mail" as const, text: getTranslation("workflow_example_4") },
    { icon: "mail" as const, text: getTranslation("workflow_example_5") },
    { icon: "smartphone" as const, text: getTranslation("workflow_example_6") },
  ];

  const FilteredViewComponent = () => (
    <ClassicEmptyScreen
      Icon="zap"
      headline={getTranslation("no_workflows")}
      description={getTranslation("change_filter")}
    />
  );

  const ExampleOnlyComponent = () => {
    const containerClasses = "min-h-12 flex w-full flex-col items-center justify-center rounded-md ";
    const textClasses = "text-default  text-md line-clamp-2 font-bold leading-6 dark:text-gray-300";
    const gridContainerClasses = "flex flex-row items-center justify-center";
    const gridClasses = "grid-cols-none items-center lg:grid lg:grid-cols-3 xl:mx-20";

    return (
      <>
        <div className={containerClasses}>
          <div className=" text-center">
            <p className={textClasses}>{getTranslation("workflow_example_desc")}</p>
          </div>
        </div>
        <div className={gridContainerClasses}>
          <div className={gridClasses}>
            {exampleData.map((exampleItem, idx) => (
              <WorkflowExample key={idx} Icon={exampleItem.icon} text={exampleItem.text} />
            ))}
          </div>
        </div>
      </>
    );
  };

  const FullEmptyScreenComponent = () => {
    const mainContainerClasses = "min-h-80 flex w-full flex-col items-center justify-center rounded-md ";
    const iconBgClasses = "bg-emphasis flex h-[72px] w-[72px] items-center justify-center rounded-full";
    const mainIconClasses = "dark:text-default inline-block h-10 w-10 stroke-[1.3px]";
    const contentContainerClasses = "max-w-[420px] text-center";
    const headingClasses = "text-semibold font-cal mt-6 text-xl dark:text-gray-300";
    const descriptionClasses =
      "text-default mt-3 line-clamp-2 text-sm font-normal leading-6 dark:text-gray-300";
    const buttonContainerClasses = "mt-8 ";
    const examplesWrapperClasses = "flex flex-row items-center justify-center";
    const examplesGridClasses = "grid-cols-none items-center lg:grid lg:grid-cols-3 xl:mx-20";

    const handleCreation = (teamIdentifier?: number) => {
      workflowCreationMutation.mutate({ teamId: teamIdentifier });
    };

    return (
      <>
        <div className={mainContainerClasses}>
          <div className={iconBgClasses}>
            <Icon name="zap" className={mainIconClasses} />
          </div>
          <div className={contentContainerClasses}>
            <h2 className={headingClasses}>{getTranslation("workflows")}</h2>
            <p className={descriptionClasses}>{getTranslation("no_workflows_description")}</p>
            <div className={buttonContainerClasses}>
              <CreateButtonWithTeamsList
                subtitle={getTranslation("new_workflow_subtitle").toUpperCase()}
                createFunction={handleCreation}
                buttonText={getTranslation("create_workflow")}
                isPending={workflowCreationMutation.isPending}
                includeOrg={true}
              />
            </div>
          </div>
        </div>
        <div className={examplesWrapperClasses}>
          <div className={examplesGridClasses}>
            {exampleData.map((exampleItem, idx) => (
              <WorkflowExample key={idx} Icon={exampleItem.icon} text={exampleItem.text} />
            ))}
          </div>
        </div>
      </>
    );
  };

  if (filteredViewState) {
    return <FilteredViewComponent />;
  }

  if (exampleOnlyMode) {
    return <ExampleOnlyComponent />;
  }

  return <FullEmptyScreenComponent />;
}
