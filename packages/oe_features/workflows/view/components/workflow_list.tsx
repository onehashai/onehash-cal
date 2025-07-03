import { Plus, Edit, Trash2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@calcom/ui";
import { Button } from "@calcom/ui";

const WorkflowList = () => {
  // Sample workflow data
  const workflows = [
    {
      id: 1,
      name: "24hr Email Reminder",
      trigger: "1 day before booking",
      channels: "Email, SMS",
      status: "Active",
      event: "Booking Confirmation",
    },
    {
      id: 2,
      name: "Follow-up Survey",
      trigger: "2 hours after booking",
      channels: "Email",
      status: "Active",
      event: "Booking Completion",
    },
    {
      id: 3,
      name: "Cancellation Notice",
      trigger: "Immediately",
      channels: "Email, SMS, Push",
      status: "Inactive",
      event: null,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="border-b border-gray-100 px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-semibold text-gray-900">
                Automate Booking Reminders with Workflows
              </h1>
              <p className="text-gray-600">
                Send reminders through Email, SMS, and more — automatically and on time.
              </p>
            </div>
            <Button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </div>

          {/* Teams Filter */}
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

      {/* Workflows List */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="grid flex-1 grid-cols-4 gap-8">
                    {/* Workflow Name */}
                    <div>
                      <h3 className="mb-1 font-medium text-gray-900">{workflow.name}</h3>
                      <p className="text-sm text-gray-500">Workflow</p>
                    </div>

                    {/* Trigger Timing */}
                    <div>
                      <p className="mb-1 text-gray-900">{workflow.trigger}</p>
                      <p className="text-sm text-gray-500">Trigger</p>
                    </div>

                    {/* Delivery Channels */}
                    <div>
                      <p className="mb-1 text-gray-900">{workflow.channels}</p>
                      <p className="text-sm text-gray-500">Channels</p>
                    </div>

                    {/* Status */}
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            workflow.status === "Active" ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        <span className="text-gray-900">{workflow.status}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {workflow.status === "Active" && workflow.event ? `on ${workflow.event}` : "Status"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ml-8 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default WorkflowList;
