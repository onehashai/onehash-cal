import { useAutoAnimate } from "@formkit/auto-animate/react";
import type { Membership, Workflow } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import classNames from "@calcom/lib/classNames";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import {
  ArrowButton,
  Avatar,
  Badge,
  Button,
  ButtonGroup,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  Tooltip,
} from "@calcom/ui";

import { getActionIcon } from "../lib/getActionIcon";
import type { WorkflowStep } from "../lib/types";
import { DeleteDialog } from "./DeleteDialog";

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
  workflows: WorkflowType[] | undefined;
}

export default function WorkflowListPage({ workflows }: Props) {
  const localeData = useLocale();
  const getTranslation = localeData.t;
  const trpcUtils = trpc.useUtils();
  const deleteModalState = useState(false);
  const targetWorkflowState = useState(0);
  const animationRef = useAutoAnimate<HTMLUListElement>();
  const navigationRouter = useRouter();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = deleteModalState;
  const [targetWorkflowId, setTargetWorkflowId] = targetWorkflowState;
  const [animatedListRef] = animationRef;

  const orderMutation = trpc.viewer.workflowOrder.useMutation({
    onError: async (error) => {
      console.error(error.message);
      await trpcUtils.viewer.workflows.filteredList.cancel();
      await trpcUtils.viewer.workflows.filteredList.invalidate();
    },
    onSettled: () => {
      trpcUtils.viewer.workflows.filteredList.invalidate();
    },
  });

  async function reorderWorkflow(currentIndex: number, direction: 1 | -1) {
    if (!workflows) return;

    const workflowList = [...workflows];
    const targetIndex = currentIndex + direction;
    const currentWorkflow = workflowList[currentIndex];
    const targetWorkflow = workflowList[targetIndex];

    if (targetWorkflow) {
      workflowList[currentIndex] = targetWorkflow;
      workflowList[targetIndex] = currentWorkflow;
    }

    await trpcUtils.viewer.appRoutingForms.forms.cancel();

    const workflowIds = workflowList.map((workflow) => workflow.id);
    orderMutation.mutate({ ids: workflowIds });
  }

  const EmptyState = () => <></>;

  if (!workflows || workflows.length === 0) {
    return <EmptyState />;
  }

  const WorkflowListItem = ({ workflow, index }: { workflow: WorkflowType; index: number }) => {
    const isFirstWorkflow = index === 0;
    const isLastWorkflow = index === workflows.length - 1;
    const itemTestId = `workflow-${workflow.name.toLowerCase().replaceAll(" ", "-")}`;

    const navigateToWorkflow = async () => {
      await navigationRouter.replace(`/workflows/${workflow.id}`);
    };

    const handleDelete = () => {
      setIsDeleteModalOpen(true);
      setTargetWorkflowId(workflow.id);
    };

    const WorkflowTitle = () => {
      const generateTitle = () => {
        if (workflow.name) return workflow.name;

        const firstStep = workflow.steps[0];
        if (!firstStep) return "Untitled";

        const actionName = getTranslation(`${firstStep.action.toLowerCase()}_action`);
        const capitalizedAction = actionName.charAt(0).toUpperCase() + actionName.slice(1);
        return `Untitled (${capitalizedAction})`;
      };

      const titleClasses = classNames(
        "text-emphasis max-w-56 truncate text-sm font-medium leading-6 md:max-w-max",
        workflow.name ? "text-emphasis" : "text-subtle"
      );

      return (
        <div className="flex">
          <div className={titleClasses}>{generateTitle()}</div>
          <div>
            {workflow.readOnly && (
              <Badge variant="gray" className="ml-2 ">
                {getTranslation("readonly")}
              </Badge>
            )}
          </div>
        </div>
      );
    };

    const TriggerBadge = () => (
      <Badge variant="gray">
        <div>
          {getActionIcon(workflow.steps)}
          <span className="mr-1">{getTranslation("triggers")}</span>
          {workflow.timeUnit && workflow.time && (
            <span className="mr-1">
              {getTranslation(`${workflow.timeUnit.toLowerCase()}`, { count: workflow.time })}
            </span>
          )}
          <span>{getTranslation(`${workflow.trigger.toLowerCase()}_trigger`)}</span>
        </div>
      </Badge>
    );

    const ActiveOnBadge = () => {
      const generateBadgeContent = () => {
        if (workflow.isActiveOnAll) {
          return (
            <div>
              <Icon name="link" className="mr-1.5 inline h-3 w-3" aria-hidden="true" />
              {workflow.isOrg
                ? getTranslation("active_on_all_teams")
                : getTranslation("active_on_all_event_types")}
            </div>
          );
        }

        if (workflow.activeOn && workflow.activeOn.length > 0) {
          const filteredEvents = workflow.activeOn.filter((wf) =>
            workflow.teamId ? wf.eventType.parentId === null : true
          );

          return (
            <Tooltip
              content={filteredEvents.map((activeOn, key) => (
                <p key={key}>
                  {activeOn.eventType.title}
                  {activeOn.eventType._count.children > 0 ? ` (+${activeOn.eventType._count.children})` : ""}
                </p>
              ))}>
              <div>
                <Icon name="link" className="mr-1.5 inline h-3 w-3" aria-hidden="true" />
                {getTranslation("active_on_event_types", { count: filteredEvents.length })}
              </div>
            </Tooltip>
          );
        }

        if (workflow.activeOnTeams && workflow.activeOnTeams.length > 0) {
          return (
            <Tooltip
              content={workflow.activeOnTeams.map((activeOn, key) => (
                <p key={key}>{activeOn.team.name}</p>
              ))}>
              <div>
                <Icon name="link" className="mr-1.5 inline h-3 w-3" aria-hidden="true" />
                {getTranslation("active_on_teams", { count: workflow.activeOnTeams.length })}
              </div>
            </Tooltip>
          );
        }

        return (
          <div>
            <Icon name="link" className="mr-1.5 inline h-3 w-3" aria-hidden="true" />
            {workflow.isOrg ? getTranslation("no_active_teams") : getTranslation("no_active_event_types")}
          </div>
        );
      };

      return <Badge variant="gray">{generateBadgeContent()}</Badge>;
    };

    const TeamBadge = () => {
      if (!workflow.team?.name) return null;

      const avatarUrl = getPlaceholderAvatar(workflow.team.logo, workflow.team.name);
      const teamProfileUrl = workflow.team.id
        ? `/settings/teams/${workflow.team.id}/profile`
        : "/settings/my-account/profile";

      return (
        <Badge className="mr-4 mt-1 p-[1px] px-2" variant="gray">
          <Avatar
            alt={workflow.team.name}
            href={teamProfileUrl}
            imageSrc={avatarUrl}
            size="xxs"
            className="mt-[3px] inline-flex justify-center"
          />
          <div>{workflow.team.name}</div>
        </Badge>
      );
    };

    const ActionButtons = () => {
      const DesktopButtons = () => (
        <div className="hidden sm:block">
          <ButtonGroup combined>
            <Tooltip content={getTranslation("edit") as string}>
              <Button
                type="button"
                color="secondary"
                variant="icon"
                StartIcon="pencil"
                disabled={workflow.readOnly}
                onClick={navigateToWorkflow}
                data-testid="edit-button"
              />
            </Tooltip>
            <Tooltip content={getTranslation("delete") as string}>
              <Button
                onClick={handleDelete}
                color="secondary"
                variant="icon"
                disabled={workflow.readOnly}
                StartIcon="trash-2"
                data-testid="delete-button"
              />
            </Tooltip>
          </ButtonGroup>
        </div>
      );

      const MobileDropdown = () => {
        if (workflow.readOnly) return null;

        return (
          <div className="block sm:hidden">
            <Dropdown>
              <DropdownMenuTrigger asChild>
                <Button type="button" color="minimal" variant="icon" StartIcon="ellipsis" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <DropdownItem type="button" StartIcon="pencil" onClick={navigateToWorkflow}>
                    {getTranslation("edit")}
                  </DropdownItem>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <DropdownItem type="button" color="destructive" StartIcon="trash-2" onClick={handleDelete}>
                    {getTranslation("delete")}
                  </DropdownItem>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </Dropdown>
          </div>
        );
      };

      return (
        <div className="flex flex-shrink-0">
          <DesktopButtons />
          <MobileDropdown />
        </div>
      );
    };

    return (
      <li
        key={workflow.id}
        data-testid={itemTestId}
        className="group flex w-full max-w-full items-center justify-between overflow-hidden">
        {!isFirstWorkflow && <ArrowButton onClick={() => reorderWorkflow(index, -1)} arrowDirection="up" />}
        {!isLastWorkflow && <ArrowButton onClick={() => reorderWorkflow(index, 1)} arrowDirection="down" />}
        <div className="first-line:group hover:bg-muted flex w-full items-center justify-between p-4 transition sm:px-6">
          <Link href={`/workflows/${workflow.id}`} className="flex-grow cursor-pointer">
            <div className="rtl:space-x-reverse">
              <WorkflowTitle />
              <ul className="mt-1 flex flex-wrap space-x-2 sm:flex-nowrap ">
                <li>
                  <TriggerBadge />
                </li>
                <li>
                  <ActiveOnBadge />
                </li>
                <div className="block md:hidden">
                  {workflow.team?.name && (
                    <li>
                      <Badge variant="gray">
                        <>{workflow.team.name}</>
                      </Badge>
                    </li>
                  )}
                </div>
              </ul>
            </div>
          </Link>
          <div>
            <div className="hidden md:block">
              <TeamBadge />
            </div>
          </div>
          <ActionButtons />
        </div>
      </li>
    );
  };

  const containerClasses = "bg-default border-subtle overflow-hidden rounded-md border sm:mx-0";
  const listClasses = "divide-subtle !static w-full divide-y";

  return (
    <>
      <div className={containerClasses}>
        <ul className={listClasses} data-testid="workflow-list" ref={animatedListRef}>
          {workflows.map((workflow, idx) => (
            <WorkflowListItem key={workflow.id} workflow={workflow} index={idx} />
          ))}
        </ul>
        <DeleteDialog
          isOpenDialog={isDeleteModalOpen}
          setIsOpenDialog={setIsDeleteModalOpen}
          workflowId={targetWorkflowId}
          additionalFunction={async () => {
            await trpcUtils.viewer.workflows.filteredList.invalidate();
          }}
        />
      </div>
    </>
  );
}
