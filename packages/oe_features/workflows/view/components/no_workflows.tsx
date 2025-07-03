import { Plus } from "lucide-react";

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@calcom/ui";

const NoWorkflowsComponent = () => {
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

          {/* Teams Filter */}
          <div className="mb-16">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Teams:</span>
              <Select defaultValue="all">
                <SelectTrigger className="h-9 w-[100px] border-gray-200 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-500">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6" />
            <path d="m21 12-6-3-6 3-6-3" />
          </svg>
        </div>

        <h2 className="mb-4 text-xl font-semibold text-gray-900">Create your first workflow</h2>

        <p className="mb-8 max-w-md text-center leading-relaxed text-gray-600">
          With Workflows you can send automated reminders and route notifications to the right person at the
          right time.
        </p>

        <Button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>
    </div>
  );
};

export default NoWorkflowsComponent;
