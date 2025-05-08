import { Title } from "@tremor/react";

import dayjs from "@calcom/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";

import { useFilterContext } from "../context/provider";
import { valueFormatter } from "../lib/valueFormatter";
import { CardInsights } from "./Card";
import { LineChart } from "./LineChart";
import { LoadingInsight } from "./LoadingInsights";

export const WorkflowStatusLineChart = () => {
  const { t } = useLocale();
  const { filter } = useFilterContext();
  const {
    selectedTeamId,
    selectedUserId,
    selectedTimeView = "week",
    dateRange,
    selectedEventTypeId,
    isAll,
    initialConfig,
    selectedType,
  } = filter;
  const initialConfigIsReady = !!(initialConfig?.teamId || initialConfig?.userId || initialConfig?.isAll);
  let [startDate, endDate] = dateRange;
  if (!startDate || !endDate) {
    (startDate = dayjs().subtract(1, "week").startOf("day")), (endDate = dayjs().endOf("day"));
  }

  const {
    data: eventsTimeLine,
    isSuccess,
    isPending,
  } = trpc.viewer.insights.workflowsTimeline.useQuery(
    {
      timeView: selectedTimeView || "week",
      startDate: dayjs.utc(startDate).toISOString(),
      endDate: dayjs.utc(endDate).toISOString(),
      teamId: selectedTeamId ?? undefined,
      eventTypeId: selectedEventTypeId ?? undefined,
      userId: selectedUserId ?? undefined,
      isAll,
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

  if (isPending) return <LoadingInsight />;

  if (!isSuccess) return null;
  console.log("eventsTimeLine", eventsTimeLine);
  return (
    <CardInsights>
      <Title className="text-emphasis">{t("workflow_trends")}</Title>
      <LineChart
        className="linechart mt-4 h-80"
        data={eventsTimeLine ?? []}
        categories={["Sent", "Read", "Failed", "Total"]}
        index="formattedDate"
        colors={["green", "blue", "red", "purple"]}
        valueFormatter={valueFormatter}
      />
    </CardInsights>
  );
};
