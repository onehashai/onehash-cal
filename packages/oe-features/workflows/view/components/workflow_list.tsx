import { Button } from "@onehash/oe-features/ui";
import type { Membership, Workflow, WorkflowStep } from "@prisma/client";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { WorkflowActions, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";

import { WorkflowDeleteDialog } from "./workflow_delete_dialog";

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
    <div className="bg-default min-h-screen">
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
              <h1 className="text-emphasis mb-2 text-xl font-semibold sm:text-2xl">
                Automate Booking Reminders with Workflows
              </h1>
              <p className="text-default text-sm sm:text-base">
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
              const channels = Array.from(new Set(workflow.steps.map((s) => channelsMap[s.action])))
                .sort()
                .join(",");

              return (
                <div
                  key={workflow.id}
                  onClick={() => handleOnClickEdit(workflow.id)}
                  className="bg-default rounded-lg border border-gray-200 p-4 transition-shadow hover:cursor-pointer hover:shadow-sm sm:p-6">
                  {/* Mobile Layout */}
                  <div className="block sm:hidden">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-default mb-1 font-medium">
                          {workflow.name != "" ? workflow.name : "Untitled Workflow"}
                        </h3>
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          <span className="text-default text-sm">{isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>

                      {/* Mobile Action Buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOnClickEdit(workflow.id)}
                          className="text-subtle hover:bg-muted hover:text-emphasis h-8 w-8 p-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={
                            //prevent event bubbling to avoid triggering the edit action
                            (e) => {
                              e.stopPropagation();
                              handleDeleteWorkflow(workflow.id);
                            }
                          }
                          className="text-default h-8 w-8 p-2 hover:bg-gray-100 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Details */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-default text-sm">Trigger:</span>
                        <span className="text-emphasis text-sm">{trigger}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-default text-sm">Channels:</span>
                        <span className="text-emphasis text-sm">{channels}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden sm:flex sm:items-center sm:justify-between">
                    <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
                      {/* Workflow Name */}
                      <div>
                        <h3 className="text-emphasis mb-1 font-medium">
                          {workflow.name != "" ? workflow.name : "Untitled Workflow"}
                        </h3>
                        <p className="text-default text-sm">Workflow</p>
                      </div>

                      {/* Trigger On */}
                      <div>
                        <p className="text-emphasis mb-1">{trigger}</p>
                        <p className="text-default text-sm">Trigger</p>
                      </div>

                      {/* Delivery Channels */}
                      <div className="hidden md:block">
                        <p className="text-emphasis mb-1">{channels}</p>
                        <p className="text-default text-sm">Channels</p>
                      </div>

                      {/* Status */}
                      <div className="hidden md:block">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`}
                          />
                          <span className="text-emphasis">{isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Action Buttons */}
                    <div className="ml-4 flex items-center gap-2 md:ml-8">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-subtle hover:bg-muted hover:text-emphasis h-8 w-8 p-2"
                        onClick={() => handleOnClickEdit(workflow.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-subtle hover:bg-muted hover:text-emphasis h-8 w-8 p-2"
                        onClick={
                          //prevent event bubbling to avoid triggering the edit action
                          (e) => {
                            e.stopPropagation();
                            handleDeleteWorkflow(workflow.id);
                          }
                        }>
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
