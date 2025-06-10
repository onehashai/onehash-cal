import Workflows from "@calcom/features/oe/workflows/pages/index";

import PageWrapper from "@components/PageWrapper";
import type { CalPageWrapper } from "@components/PageWrapper";

const WorkflowsPage = Workflows as CalPageWrapper;
WorkflowsPage.PageWrapper = PageWrapper;

export default WorkflowsPage;
