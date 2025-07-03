import { NoWorkflowsComponent, WorkflowList } from "../components";

const WorkflowsListPage = (workflows: []) => {
  if (workflows.length === 0) {
    return <NoWorkflowsComponent />;
  } else {
    return <WorkflowList workflows={workflows} />;
  }
};

export default WorkflowsListPage;
