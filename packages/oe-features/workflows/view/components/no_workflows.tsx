import { Button } from "@onehash/oe-features/ui";
import { Plus } from "lucide-react";

import { Icon } from "@calcom/ui";

interface Props {
  createWorkflowFn: () => void;
  loading?: boolean;
}
const NoWorkflowsComponent = ({ createWorkflowFn, loading }: Props) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">
            Automate Booking Reminders with Workflows
          </h1>
          <p className="mb-8 text-gray-600">
            Send reminders through Email, SMS, and more — automatically and on time.
          </p>
          {/* //OE_FEATURES: will enable after developing teams
          <div className="w-[200px]">
            <TeamsSelectFilter />
          </div> */}
        </div>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Icon name="zap" className="h-8 w-8 text-gray-500" />
        </div>

        <h2 className="mb-4 text-xl font-semibold text-gray-900">Create your first workflow</h2>

        <p className="mb-8 max-w-md text-center leading-relaxed text-gray-600">
          With Workflows you can send automated reminders and route notifications to the right person at the
          right time.
        </p>

        <Button
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => {
            createWorkflowFn();
          }}
          loading={loading}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>
    </div>
  );
};

export default NoWorkflowsComponent;
