import { Button } from "@onehash/oe-features/ui";
import type { Membership, Workflow } from "@prisma/client";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { WorkflowActions, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";

import type { WorkflowStep } from "../../types";
import { WorkflowDeleteDialog } from "../components/workflow_delete_dialog";

export type WorkflowType = Workflow & {
  team: {
    id: number;
    name: string;
    members: Membership[];
    slug: string | null;
    logo?: string | null;
  } | null;
  steps: WorkflowStep[];
  activeOnTeams?: {
    team: {
      id: number;
      name?: string | null;
    };
  }[];
  activeOn?: {
    eventType: {
      id: number;
      title: string;
      parentId: number | null;
      _count: {
        children: number;
      };
    };
  }[];
  readOnly?: boolean;
  isOrg?: boolean;
};

interface Props {
  workflows: WorkflowType[];
  createWorkflowFn: () => void;
  loading?: boolean;
}

const WorkflowList = ({ workflows, createWorkflowFn, loading }: Props) => {
  const router = useRouter();

  const channelsMap: Record<WorkflowActions, string> = {
    [WorkflowActions.EMAIL_HOST]: "EMAIL",
    [WorkflowActions.EMAIL_ATTENDEE]: "EMAIL",
    [WorkflowActions.SMS_ATTENDEE]: "SMS",
    [WorkflowActions.SMS_NUMBER]: "SMS",
    [WorkflowActions.EMAIL_ADDRESS]: "EMAIL",
    [WorkflowActions.WHATSAPP_ATTENDEE]: "WHATSAPP",
    [WorkflowActions.WHATSAPP_NUMBER]: "WHATSAPP",
  };

  const triggerMap: Record<WorkflowTriggerEvents, string> = {
    [WorkflowTriggerEvents.BEFORE_EVENT]: "Before Event",
    [WorkflowTriggerEvents.AFTER_EVENT]: "After Event",
    [WorkflowTriggerEvents.NEW_EVENT]: "New Event",
    [WorkflowTriggerEvents.EVENT_CANCELLED]: "Event Cancelled",
    [WorkflowTriggerEvents.RESCHEDULE_EVENT]: "Event Rescheduled",
    [WorkflowTriggerEvents.AFTER_HOSTS_CAL_VIDEO_NO_SHOW]: "After Hosts Calendar Video No Show",
    [WorkflowTriggerEvents.AFTER_GUESTS_CAL_VIDEO_NO_SHOW]: "After Guests Calendar Video No Show",
  };
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowIdToDelete, setWorkflowIdToDelete] = useState(0);
  const handleDeleteWorkflow = async (workflowId: number) => {
    setDeleteDialogOpen(true);
    setWorkflowIdToDelete(workflowId);
  };

  const handleOnClickEdit = (workflowId: number) => {
    router.replace(`/workflows/${workflowId}`);
  };

  const utils = trpc.useUtils();

  return (
    <div className="min-h-screen bg-white">
      <WorkflowDeleteDialog
        isOpenDialog={deleteDialogOpen}
        setIsOpenDialog={setDeleteDialogOpen}
        workflowId={workflowIdToDelete}
        additionalFunction={async () => {
          await utils.viewer.workflows.filteredList.invalidate();
        }}
      />
      {/* Header Section */}
      <div className="border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h1 className="mb-2 text-xl font-semibold text-gray-900 sm:text-2xl">
                Automate Booking Reminders with Workflows
              </h1>
              <p className="text-sm text-gray-600 sm:text-base">
                Send reminders through Email, SMS, and more — automatically and on time.
              </p>
            </div>
            <Button
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
              onClick={() => {
                createWorkflowFn();
              }}
              loading={loading}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </div>
          {/* //OE_FEATURES: will enable after developing teams
          <div className="w-full sm:w-[200px]">
            <TeamsSelectFilter />
          </div> */}
        </div>
      </div>

      {/* Workflows List */}
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4">
            {workflows.map((workflow) => {
              const isActive = workflow.activeOn?.length || workflow.activeOnTeams?.length;
              const trigger = triggerMap[workflow.trigger];
              const channels = workflow.steps
                .map((s) => channelsMap[s.action])
                .sort()
                .join(",");

              return (
                <div
                  key={workflow.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm sm:p-6">
                  {/* Mobile Layout */}
                  <div className="block sm:hidden">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-1 font-medium text-gray-900">
                          {workflow.name != "" ? workflow.name : "Untitled Workflow"}
                        </h3>
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          <span className="text-sm text-gray-600">{isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>

                      {/* Mobile Action Buttons */}
                      <div className="flex items-center gap-1">
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

                    {/* Mobile Details */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Trigger:</span>
                        <span className="text-sm text-gray-900">{trigger}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Channels:</span>
                        <span className="text-sm text-gray-900">{channels}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden sm:flex sm:items-center sm:justify-between">
                    <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
                      {/* Workflow Name */}
                      <div>
                        <h3 className="mb-1 font-medium text-gray-900">
                          {workflow.name != "" ? workflow.name : "Untitled Workflow"}
                        </h3>
                        <p className="text-sm text-gray-500">Workflow</p>
                      </div>

                      {/* Trigger On */}
                      <div>
                        <p className="mb-1 text-gray-900">{trigger}</p>
                        <p className="text-sm text-gray-500">Trigger</p>
                      </div>

                      {/* Delivery Channels */}
                      <div className="hidden md:block">
                        <p className="mb-1 text-gray-900">{channels}</p>
                        <p className="text-sm text-gray-500">Channels</p>
                      </div>

                      {/* Status */}
                      <div className="hidden md:block">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          <span className="text-gray-900">{isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Action Buttons */}
                    <div className="ml-4 flex items-center gap-2 md:ml-8">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        onClick={() => handleOnClickEdit(workflow.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                        onClick={() => handleDeleteWorkflow(workflow.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowList;
