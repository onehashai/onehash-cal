"use client";

import { useRouter } from "next/navigation";

import { getLayout } from "@calcom/features/MainLayout";
import { FilterResults } from "@calcom/features/filters/components/FilterResults";
import { TeamsFilter } from "@calcom/features/filters/components/TeamsFilter";
import { getTeamsFiltersFromQuery } from "@calcom/features/filters/lib/getTeamsFiltersFromQuery";
import { ShellMain } from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { CreateButtonWithTeamsList, showToast } from "@calcom/ui";

import EmptyScreen from "../components/EmptyScreen";
import { SkeletonLoaderList } from "../components/SkeletonLoader";
import WorkflowList from "../components/WorkflowListPage";

function WorkflowsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const routerQuery = useRouterQuery();
  const filters = getTeamsFiltersFromQuery(routerQuery);

  const queryRes = trpc.viewer.workflows.filteredList.useQuery({
    filters,
  });

  const createMutation = trpc.viewer.workflows.create.useMutation({
    onSuccess: async ({ workflow }) => {
      await router.replace(`/workflows/${workflow.id}`);
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
      }

      if (err.data?.code === "UNAUTHORIZED") {
        const message = `${err.data.code}: ${t("error_workflow_unauthorized_create")}`;
        showToast(message, "error");
      }
    },
  });

  return (
    <ShellMain
      heading={t("workflows")}
      title={t("workflows")}
      subtitle={t("workflows_to_automate_notifications")}
      hideHeadingOnMobile
      CTA={
        <CreateButtonWithTeamsList
          subtitle={t("new_workflow_subtitle").toUpperCase()}
          createFunction={(teamId?: number) => {
            createMutation.mutate({ teamId });
          }}
          isPending={createMutation.isPending}
          disableMobileButton={true}
          onlyShowWithNoTeams={true}
        />
      }>
      <>
        {queryRes.data?.totalCount ? (
          <div className="flex">
            <TeamsFilter />
            <div className="ml-auto">
              <CreateButtonWithTeamsList
                subtitle={t("new_workflow_subtitle").toUpperCase()}
                createFunction={(teamId?: number) => createMutation.mutate({ teamId })}
                isPending={createMutation.isPending}
                disableMobileButton={true}
                onlyShowWithTeams={true}
              />
            </div>
          </div>
        ) : null}
        <FilterResults
          queryRes={queryRes}
          emptyScreen={<EmptyScreen isFilteredView={false} />}
          noResultsScreen={<EmptyScreen isFilteredView={true} />}
          SkeletonLoader={SkeletonLoaderList}>
          <WorkflowList workflows={queryRes.data?.filtered ?? []} />
        </FilterResults>
      </>
    </ShellMain>
  );
}

WorkflowsPage.getLayout = getLayout;

export default WorkflowsPage;
