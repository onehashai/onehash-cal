import { WorkflowEditor as Workflow } from "@onehash/oe-features/workflows/view/pages";
import type { GetStaticPaths } from "next";

import { getStaticProps } from "@lib/workflows/[workflow]/getStaticProps";

import PageWrapper from "@components/PageWrapper";
import type { CalPageWrapper } from "@components/PageWrapper";

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

const WorkflowsPage = Workflow as CalPageWrapper;
WorkflowsPage.PageWrapper = PageWrapper;

export default WorkflowsPage;
export { getStaticProps };
