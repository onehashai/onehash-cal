import { Grid } from "@tremor/react";
import { Flex, Text, Metric } from "@tremor/react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";

import { useFilterContext } from "../context/provider";
import { valueFormatter } from "../lib";
import { CardInsights } from "./Card";

export const WorkflowKPICards = () => {
  const { t } = useLocale();
  const { filter } = useFilterContext();

  const {
    dateRange,
    selectedUserId,
    selectedTeamId: teamId,
    selectedEventTypeId,
    selectedType,
    initialConfig,
  } = filter;
  const initialConfigIsReady = !!(initialConfig?.teamId || initialConfig?.userId || initialConfig?.isAll);
  const [startDate, endDate] = dateRange;
  const { data, isSuccess, isPending } = trpc.viewer.insights.workflowsByStatus.useQuery(
    {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      userId: selectedUserId ?? undefined,
      teamId,
      eventTypeId: selectedEventTypeId ?? undefined,
      type: selectedType,
    },
    {
      staleTime: 30000,
      trpc: {
        context: { skipBatch: true },
      },
      enabled: initialConfigIsReady,
    }
  );
  const categories: {
    title: string;
    index: "total" | "sentCount" | "readCount" | "failedCount";
  }[] = [
    {
      title: t("workflows_total_responses"),
      index: "total",
    },
    {
      title: t("workflows_sent_responses"),
      index: "sentCount",
    },
    {
      title: t("workflows_read_responses"),
      index: "readCount",
    },
    {
      title: t("workflows_failed_responses"),
      index: "failedCount",
    },
  ];

  if (isPending) {
    return <LoadingKPICards categories={categories} />;
  }

  if (!isSuccess || !startDate || !endDate || (!teamId && !selectedUserId)) return null;
  return (
    <>
      <Grid numColsSm={1} numColsLg={3} className="mt-4 gap-x-4 gap-y-4">
        {categories.map((item) => (
          <CardInsights key={item.title}>
            <Text className="text-default">{item.title}</Text>
            <Flex className="items-baseline justify-start space-x-3 truncate">
              <Metric className="text-emphasis">{valueFormatter(data[item.index])}</Metric>
            </Flex>
          </CardInsights>
        ))}
      </Grid>
    </>
  );
};

const LoadingKPICards = (props: { categories: { title: string; index: string }[] }) => {
  const { categories } = props;
  return (
    <Grid numColsSm={2} numColsLg={4} className="mt-4 gap-x-4 gap-y-4">
      {categories.map((item) => (
        <CardInsights key={item.title}>
          <div className="animate-pulse">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-4 flex items-baseline space-x-3">
              <div className="h-8 w-16 rounded bg-gray-200" />
            </div>
          </div>
        </CardInsights>
      ))}
    </Grid>
  );
};
