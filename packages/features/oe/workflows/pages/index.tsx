"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import LicenseRequired from "@calcom/features/oe/common/components/LicenseRequired";
import Shell, { ShellMain } from "@calcom/features/shell/Shell";
import { classNames } from "@calcom/lib";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import { HttpError } from "@calcom/lib/http-error";
import type { WorkflowRepository } from "@calcom/lib/server/repository/workflow";
import { trpc } from "@calcom/trpc/react";
import { AnimatedPopover, Avatar, CreateButtonWithTeamsList, showToast } from "@calcom/ui";

import { FilterResults } from "../../../filters/components/FilterResults";
import { TeamsFilter } from "../../../filters/components/TeamsFilter";
import { getTeamsFiltersFromQuery } from "../../../filters/lib/getTeamsFiltersFromQuery";
import EmptyScreen from "../components/EmptyScreen";
import SkeletonLoader from "../components/SkeletonLoaderList";
import WorkflowList from "../components/WorkflowListPage";

type PageProps = {
  filteredList?: Awaited<ReturnType<typeof WorkflowRepository.getFilteredList>>;
};

function WorkflowsPage({ filteredList }: PageProps) {
  const localization = useLocale();
  const currentSession = useSession();
  const navigationRouter = useRouter();
  const routerQueryParams = useRouterQuery();
  const filterConfiguration = getTeamsFiltersFromQuery(routerQueryParams);

  const workflowQuery = trpc.viewer.workflows.filteredList.useQuery(
    { filters: filterConfiguration },
    { enabled: !filteredList }
  );

  const processedWorkflows = filteredList ?? workflowQuery.data;
  const isDataLoading = filteredList ? false : workflowQuery.isPending;

  const workflowCreationMutation = trpc.viewer.workflows.create.useMutation({
    onSuccess: async ({ workflow }) => {
      await navigationRouter.replace(`/workflows/${workflow.id}`);
    },
    onError: (errorResponse) => {
      handleWorkflowCreationError(errorResponse, localization.t);
    },
  });

  const renderCreateButton = (showOnlyWithTeams: boolean) => (
    <CreateButtonWithTeamsList
      subtitle={localization.t("new_workflow_subtitle").toUpperCase()}
      createFunction={(teamIdentifier?: number) => {
        workflowCreationMutation.mutate({ teamId: teamIdentifier });
      }}
      isPending={workflowCreationMutation.isPending}
      disableMobileButton={true}
      onlyShowWithNoTeams={!showOnlyWithTeams}
      onlyShowWithTeams={showOnlyWithTeams}
      includeOrg={true}
    />
  );

  return (
    <Shell withoutMain>
      <LicenseRequired>
        <ShellMain
          heading={localization.t("workflows")}
          subtitle={localization.t("workflows_to_automate_notifications")}
          title={localization.t("workflows")}
          description={localization.t("workflows_to_automate_notifications")}
          hideHeadingOnMobile
          CTA={currentSession.data?.hasValidLicense ? renderCreateButton(false) : null}>
          <>
            <FilterResults
              queryRes={{ isLoading: isDataLoading, data: processedWorkflows }}
              emptyScreen={<EmptyScreen isFilteredView={false} />}
              noResultsScreen={<EmptyScreen isFilteredView={true} />}
              SkeletonLoader={SkeletonLoader}>
              <EmptyScreen isFilteredView={false} onlyExample={true} />
              <div className="mt-4 flex">
                <TeamsFilter />
                <div className="mb-4 ml-auto">{renderCreateButton(true)}</div>
              </div>
              <WorkflowList workflows={processedWorkflows?.filtered} />
            </FilterResults>
          </>
        </ShellMain>
      </LicenseRequired>
    </Shell>
  );
}

const Filter = (filterProps: {
  profiles: {
    readOnly?: boolean | undefined;
    slug: string | null;
    name: string | null;
    teamId: number | null | undefined;
    image?: string | undefined | null;
  }[];
  checked: {
    userId: number | null;
    teamIds: number[];
  };
  setChecked: Dispatch<
    SetStateAction<{
      userId: number | null;
      teamIds: number[];
    }>
  >;
}) => {
  const sessionData = useSession();
  const currentUserId = sessionData.data?.user.id || 0;
  const currentUserName = sessionData.data?.user.name || "";
  const currentUsername = sessionData.data?.user.username;
  const userAvatarUrl = `${WEBAPP_URL}/${currentUsername}/avatar.png`;

  const teamProfiles = filterProps.profiles.filter((profile) => !!profile.teamId);
  const { checked: selectedFilters, setChecked: updateSelectedFilters } = filterProps;

  const [isUnfiltered, setIsUnfiltered] = useState(true);

  const handleUserSelectionChange = (isSelected: boolean) => {
    if (isSelected) {
      updateSelectedFilters({
        userId: currentUserId,
        teamIds: selectedFilters.teamIds,
      });
      if (selectedFilters.teamIds.length === teamProfiles.length) {
        setIsUnfiltered(true);
      }
    } else {
      updateSelectedFilters({
        userId: null,
        teamIds: selectedFilters.teamIds,
      });
      setIsUnfiltered(false);
    }
  };

  const handleTeamSelectionChange = (teamId: number, isSelected: boolean) => {
    const updatedTeamIds = isSelected
      ? [...selectedFilters.teamIds, teamId]
      : selectedFilters.teamIds.filter((id) => id !== teamId);

    updateSelectedFilters({
      userId: selectedFilters.userId,
      teamIds: updatedTeamIds,
    });

    const shouldShowUnfiltered = !!selectedFilters.userId && updatedTeamIds.length === teamProfiles.length;
    setIsUnfiltered(shouldShowUnfiltered);
  };

  const renderUserFilterOption = () => (
    <div className="item-center focus-within:bg-subtle hover:bg-muted flex px-4 py-[6px] transition hover:cursor-pointer">
      <Avatar
        imageSrc={userAvatarUrl || ""}
        size="sm"
        alt={`${currentUserName} Avatar`}
        className="self-center"
        asChild
      />
      <label
        htmlFor="userWorkflowFilter"
        className="text-default ml-2 mr-auto self-center truncate text-sm font-medium">
        {currentUserName}
      </label>
      <input
        id="userWorkflowFilter"
        type="checkbox"
        className="text-emphasis focus:ring-emphasis dark:text-muted border-default inline-flex h-4 w-4 place-self-center justify-self-end rounded transition"
        checked={!!selectedFilters.userId}
        onChange={(event) => handleUserSelectionChange(event.target.checked)}
      />
    </div>
  );

  const renderTeamFilterOption = (teamProfile: (typeof teamProfiles)[0]) => (
    <div
      className="item-center focus-within:bg-subtle hover:bg-muted flex px-4 py-[6px] transition hover:cursor-pointer"
      key={`team-${teamProfile.teamId || 0}`}>
      <Avatar
        imageSrc={teamProfile.image || ""}
        size="sm"
        alt={`${teamProfile.slug} Avatar`}
        className="self-center"
        asChild
      />
      <label
        htmlFor={teamProfile.slug || ""}
        className="text-default ml-2 mr-auto select-none self-center truncate text-sm font-medium hover:cursor-pointer">
        {teamProfile.slug}
      </label>
      <input
        id={teamProfile.slug || ""}
        name={teamProfile.slug || ""}
        type="checkbox"
        checked={selectedFilters.teamIds?.includes(teamProfile.teamId || 0)}
        onChange={(event) => handleTeamSelectionChange(teamProfile.teamId || 0, event.target.checked)}
        className="text-emphasis focus:ring-emphasis dark:text-muted border-default inline-flex h-4 w-4 place-self-center justify-self-end rounded transition"
      />
    </div>
  );

  return (
    <div className={classNames("-mb-2", isUnfiltered ? "w-16" : "w-[100px]")}>
      <AnimatedPopover text={isUnfiltered ? "All" : "Filtered"}>
        {renderUserFilterOption()}
        {teamProfiles.map(renderTeamFilterOption)}
      </AnimatedPopover>
    </div>
  );
};

function handleWorkflowCreationError(errorResponse: any, translateFunction: (key: string) => string) {
  if (errorResponse instanceof HttpError) {
    const errorMessage = `${errorResponse.statusCode}: ${errorResponse.message}`;
    showToast(errorMessage, "error");
    return;
  }

  if (errorResponse.data?.code === "UNAUTHORIZED") {
    const unauthorizedMessage = `${errorResponse.data.code}: ${translateFunction(
      "error_workflow_unauthorized_create"
    )}`;
    showToast(unauthorizedMessage, "error");
  }
}

export default WorkflowsPage;
