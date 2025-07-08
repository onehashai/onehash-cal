import { NoWorkflowsComponent, WorkflowList } from "@onehash/oe-features/workflows/view/components";
import { useRouter } from "next/navigation";

import { getTeamsFiltersFromQuery } from "@calcom/features/filters/lib/getTeamsFiltersFromQuery";
import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { showToast } from "@calcom/ui";

type PageProps = {
  // filteredList?: Awaited<ReturnType<typeof WorkflowRepository.getFilteredList>>;
};
function WorkflowsListPage({}: PageProps) {
  const { t } = useLocale();
  const router = useRouter();
  const routerQuery = useRouterQuery();
  const filters = getTeamsFiltersFromQuery(routerQuery);
  const { data, isPending } = trpc.viewer.workflows.filteredList.useQuery(
    {
      filters,
    },
    {
      enabled: true, // Only fetch if filters are defined
    }
  );
  const filteredWorkflows = data;

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
    <Shell withoutMain>
      {filteredWorkflows?.totalCount ? (
        <WorkflowList
          workflows={filteredWorkflows?.filtered}
          createWorkflowFn={() => {
            createMutation.mutate({
              teamId: undefined,
            });
          }}
          loading={createMutation.isPending}
        />
      ) : (
        <NoWorkflowsComponent
          createWorkflowFn={() => {
            createMutation.mutate({
              teamId: undefined,
            });
          }}
          loading={createMutation.isPending}
        />
      )}
    </Shell>
  );
}

export default WorkflowsListPage;
