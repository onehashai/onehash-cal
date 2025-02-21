import { withAppDirSsr } from "app/WithAppDirSsr";
import { _generateMetadata } from "app/_utils";
import { WithLayout } from "app/layoutHOC";

import { getServerSideProps } from "@lib/insights/getServerSideProps";

import InsightsWorkflowPage from "~/insights/insights-workflow-view";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("insights"),
    (t) => t("insights_workflow_subtitle")
  );

const getData = withAppDirSsr(getServerSideProps);

export default WithLayout({ getLayout: null, getData, Page: InsightsWorkflowPage });
