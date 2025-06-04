import type { Table } from "@tanstack/react-table";
import type { Dispatch, SetStateAction } from "react";
import { useState, Fragment } from "react";

import { DataTableSelectionBar } from "@calcom/features/data-table";
import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { SchedulingType } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  showToast,
  PopoverContent,
  PopoverTrigger,
  Icon,
} from "@calcom/ui";

import type { User } from "./MemberList";

interface Props {
  table: Table<User>;
  teamId: number;
}

const modifyEventSelection = (
  eventIdCollection: Set<number>,
  updateFunction: Dispatch<SetStateAction<Set<number>>>,
  eventIds: number[],
  operation: "add" | "remove"
) => {
  const modifiedCollection = new Set(eventIdCollection);

  if (operation === "add") {
    eventIds.forEach((id) => modifiedCollection.add(id));
  } else {
    eventIds.forEach((id) => modifiedCollection.delete(id));
  }

  updateFunction(modifiedCollection);
};

const SelectableEventItem = ({
  onSelect,
  text,
  isSelected,
}: {
  text: string;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <CommandItem key={text} onSelect={onSelect}>
    {text}
    <div
      className={classNames(
        "border-subtle ml-auto flex h-4 w-4 items-center justify-center rounded-sm border",
        isSelected ? "text-emphasis" : "opacity-50 [&_svg]:invisible"
      )}>
      <Icon name="check" className={classNames("h-4 w-4")} />
    </div>
  </CommandItem>
);

export function EventTypesList({ table, teamId }: Props) {
  const { t } = useLocale();
  const trpcUtils = trpc.useUtils();

  const [eventsToAdd, setEventsToAdd] = useState<Set<number>>(new Set());
  const [eventsToRemoveFrom, setEventsToRemoveFrom] = useState<Set<number>>(new Set());

  const { data: eventTypesData } = trpc.viewer.eventTypes.getByViewer.useQuery({
    filters: { teamIds: [teamId], schedulingTypes: [SchedulingType.ROUND_ROBIN] },
  });

  const eventGroupData = eventTypesData?.eventTypeGroups;
  const selectedUsersList = table.getSelectedRowModel().flatRows.map((row) => row.original);

  const hostAdditionMutation = trpc.viewer.teams.addMembersToEventTypes.useMutation({
    onError: (err) => {
      showToast(err.message, "error");
    },
    onSuccess: () => {
      showToast(
        `${selectedUsersList.length} users added to ${Array.from(eventsToAdd).length} events`,
        "success"
      );

      trpcUtils.viewer.teams.listMembers.invalidate();
      trpcUtils.viewer.eventTypes.invalidate();

      setEventsToAdd(new Set());
      table.toggleAllRowsSelected(false);
    },
  });

  const hostRemovalMutation = trpc.viewer.teams.removeHostsFromEventTypes.useMutation({
    onError: (err) => {
      showToast(err.message, "error");
    },
    onSuccess: () => {
      showToast(
        `${selectedUsersList.length} users were removed from ${Array.from(eventsToRemoveFrom).length} events`,
        "success"
      );

      trpcUtils.viewer.teams.listMembers.invalidate();
      trpcUtils.viewer.eventTypes.invalidate();

      setEventsToRemoveFrom(new Set());
      table.toggleAllRowsSelected(false);
    },
  });

  const handleEventSelection = (eventId: number, existingHosts: any[], isCurrentlySelected: boolean) => {
    const allUsersAreHosts = selectedUsersList.every((user) =>
      existingHosts.some((host) => host.userId === user.id)
    );

    if (!isCurrentlySelected) {
      if (allUsersAreHosts) {
        modifyEventSelection(eventsToRemoveFrom, setEventsToRemoveFrom, [eventId], "remove");
      } else {
        modifyEventSelection(eventsToAdd, setEventsToAdd, [eventId], "add");
      }
    } else {
      if (allUsersAreHosts) {
        modifyEventSelection(eventsToRemoveFrom, setEventsToRemoveFrom, [eventId], "add");
      } else {
        modifyEventSelection(eventsToAdd, setEventsToAdd, [eventId], "remove");
      }
    }
  };

  const executeChanges = async () => {
    const userIdsList = selectedUsersList.map((user) => user.id);

    if (eventsToAdd.size > 0) {
      await hostAdditionMutation.mutateAsync({
        userIds: userIdsList,
        eventTypeIds: Array.from(eventsToAdd),
        teamId,
      });
    }

    if (eventsToRemoveFrom.size > 0) {
      await hostRemovalMutation.mutateAsync({
        userIds: userIdsList,
        eventTypeIds: Array.from(eventsToRemoveFrom),
        teamId,
      });
    }
  };

  const renderEventTypeGroups = () => {
    if (!eventGroupData) return null;

    return eventGroupData.map((groupData) => {
      const { eventTypes: eventsList, teamId: groupTeamId } = groupData;

      if (eventsList.length === 0 || !groupTeamId) return null;

      return (
        <Fragment key={groupTeamId}>
          {eventsList.map((eventType) => {
            const eventHosts = eventType.hosts;
            const usersAlreadyHosts = selectedUsersList.every((user) =>
              eventHosts.some((host) => host.userId === user.id)
            );

            const isEventSelected =
              (eventsToAdd.has(eventType.id) || usersAlreadyHosts) && !eventsToRemoveFrom.has(eventType.id);

            return (
              <SelectableEventItem
                key={eventType.id}
                text={eventType.title}
                isSelected={isEventSelected}
                onSelect={() => handleEventSelection(eventType.id, eventHosts, isEventSelected)}
              />
            );
          })}
        </Fragment>
      );
    });
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <DataTableSelectionBar.Button icon="link">{t("add_to_event_type")}</DataTableSelectionBar.Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0 shadow-md" align="start" sideOffset={12}>
          <Command>
            <CommandInput placeholder={t("search")} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>{renderEventTypeGroups()}</CommandGroup>
            </CommandList>
          </Command>
          <div className="my-1.5 flex w-full">
            <Button className="ml-auto mr-1.5 rounded-md" size="sm" onClick={executeChanges}>
              {t("apply")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
