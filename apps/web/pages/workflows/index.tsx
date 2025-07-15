import { WorkflowsListPage as Workflows } from "@onehash/oe-features/workflows/view/pages";

import PageWrapper from "@components/PageWrapper";
import type { CalPageWrapper } from "@components/PageWrapper";

const WorkflowsPage = Workflows as CalPageWrapper;
WorkflowsPage.PageWrapper = PageWrapper;

export default WorkflowsPage;
