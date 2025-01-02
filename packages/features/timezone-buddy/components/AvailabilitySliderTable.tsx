"use client";

import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@calcom/dayjs";
import { DataTable, DataTableToolbar } from "@calcom/features/data-table";
import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import type { DateRange } from "@calcom/lib/date-ranges";
import { useDebounce } from "@calcom/lib/hooks/useDebounce";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";
import type { UserProfile } from "@calcom/types/UserProfile";
import {
  Button,
  ButtonGroup,
  UserAvatar,
  Checkbox,
  showToast,
  Dropdown,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownItem,
  Switch,
} from "@calcom/ui";

import { GroupMeetingDialog } from "../../../../apps/web/components/dialog/GroupMeetingDialog";
import { UpgradeTip } from "../../tips/UpgradeTip";
import { createTimezoneBuddyStore, TBContext } from "../store";
import { AvailabilityEditSheet } from "./AvailabilityEditSheet";
import { CellHighlightContainer } from "./CellHighlightContainer";
import { TimeDial } from "./TimeDial";

export interface SliderUser {
  id: number;
  username: string;
  name: string | null;
  organizationId: number | null;
  avatarUrl?: string | null;
  email: string;
  timeZone: string;
  defaultScheduleId: number | null;
  dateRanges: DateRange[];
  profile?: UserProfile;
  teamName: string[];
}

function UpgradeTeamTip() {
  const { t } = useLocale();

  return (
    <UpgradeTip
      plan="team"
      title={t("calcom_is_better_with_team", { appName: APP_NAME }) as string}
      description="add_your_team_members"
      background="/tips/teams"
      features={[]}
      buttons={
        <div className="space-y-2 rtl:space-x-reverse sm:space-x-2">
          <ButtonGroup>
            <Button color="primary" href={`${WEBAPP_URL}/settings/teams/new`}>
              {t("create_team")}
            </Button>
            <Button color="minimal" href="https://www.onehash.ai/cal" target="_blank">
              {t("learn_more")}
            </Button>
          </ButtonGroup>
        </div>
      }>
      <></>
    </UpgradeTip>
  );
}

const ReadOnlyDropdown: React.FC<{
  teamName: string[];
}> = ({ teamName }) => {
  const [opened, setOpened] = useState<boolean>(false);
  const { t } = useLocale();
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}>
      <Dropdown
        modal={false}
        open={opened}
        onOpenChange={(_) => {
          setOpened(!opened);
        }}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="icon"
            color="secondary"
            className="ltr:radix-state-open:rounded-r-md rtl:radix-state-open:rounded-l-md">
            {t("view_membership")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[200px]">
          {teamName.map((item, index) => {
            const _teamName = item.charAt(0).toUpperCase() + item.slice(1);
            return (
              <DropdownMenuItem key={index}>
                <DropdownItem type="button">{_teamName}</DropdownItem>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </Dropdown>
    </div>
  );
};

export function AvailabilitySliderTable(props: { userTimeFormat: number | null }) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [browsingDate, setBrowsingDate] = useState(dayjs());
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SliderUser | null>(null);
  const [searchString, setSearchString] = useState("");
  const debouncedSearchString = useDebounce(searchString, 500);

  const tbStore = createTimezoneBuddyStore({
    browsingDate: browsingDate.toDate(),
  });

  const { data, isPending, fetchNextPage, isFetching } = trpc.viewer.availability.listTeam.useInfiniteQuery(
    {
      limit: 20,
      loggedInUsersTz: dayjs.tz.guess() || "Europe/London",
      startDate: browsingDate.startOf("day").toISOString(),
      endDate: browsingDate.endOf("day").toISOString(),
      searchString: debouncedSearchString,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: keepPreviousData,
    }
  );
  // Assuming `data` is defined and has the appropriate structure
  // Assuming `data` is defined and has the appropriate structure
  const [flatData, totalFetched] = useMemo(() => {
    const userMap = new Map<string, SliderUser>();

    // Collect the original data to calculate totalFetched
    const originalData = data?.pages?.flatMap((page) => page.rows) ?? [];
    const totalFetched = originalData.length;

    originalData.forEach((user) => {
      if (userMap.has(user.username)) {
        const existingUser = userMap.get(user.username) as SliderUser;
        existingUser.teamName.push(user.teamName);
      } else {
        userMap.set(user.username, { ...user, teamName: [user.teamName] });
      }
    });

    // Return the merged users and totalFetched as an array
    return [Array.from(userMap.values()), totalFetched] as [SliderUser[], number];
  }, [data]);

  const totalDBRowCount = data?.pages?.[0]?.meta?.totalRowCount ?? 0;

  //TEAM MEMBER MEETING SCHEDULING LOGIC
  const [isMemberSelectEnabled, setIsMemberSelectEnabled] = useState<boolean>(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const allUsernames = flatData.map((user) => user.username);
        setSelectedMembers(allUsernames);
      } else {
        setSelectedMembers([]);
      }
    },
    [flatData]
  );

  const handleSelectMember = (username: string) => {
    setSelectedMembers((prevSelected) =>
      prevSelected.includes(username)
        ? prevSelected.filter((member) => member !== username)
        : [...prevSelected, username]
    );
  };
  const [meetingUrl, setMeetingUrl] = useState<string>("");
  const [isOpenDialog, setIsOpenDialog] = useState<boolean>(false);

  const handleBookMembers = () => {
    if (selectedMembers.length == 0) {
      showToast("Please select atleast one member", "error");
      return;
    }
    const url = `${WEBAPP_URL}/${selectedMembers.join("+")}`;
    setMeetingUrl(url);
    setIsOpenDialog(true);
    // const openCalendar = () => {
    //   // Dimensions and other properties of the popup window
    //   const width = 800;
    //   const height = 600;
    //   const left = (window.innerWidth - width) / 2;
    //   const top = (window.innerHeight - height) / 2;
    //   const options = `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars=yes,status=1`;

    //   const url = `${WEBAPP_URL}/${selectedMembers.join("+")}`;
    //   console.log(`url: ${url}`);
    //   window.open(url, "_blank", options);
    // };

    // openCalendar();
  };

  const memorisedColumns = useMemo(() => {
    const cols: ColumnDef<SliderUser>[] = [];

    if (isMemberSelectEnabled) {
      cols.push({
        id: "select",
        header: ({ table }) => {
          return (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => {
                handleSelectAll(!!value);
                table.toggleAllPageRowsSelected(!!value);
              }}
              aria-label="Select all"
              className="translate-y-[2px]"
            />
          );
        },
        cell: ({ row }) => {
          return (
            <Checkbox checked={row.getIsSelected()} aria-label="Select row" className="translate-y-[2px]" />
          );
        },
      });
    }

    cols.push(
      {
        id: "member",
        accessorFn: (data) => data.username,
        header: "Member",
        size: 200,
        cell: ({ row }) => {
          const { username, email, timeZone, name, avatarUrl, profile } = row.original;
          return (
            <div className="max-w-64 flex flex-shrink-0 items-center gap-2 overflow-hidden">
              <UserAvatar
                size="sm"
                user={{
                  username,
                  name,
                  avatarUrl: avatarUrl ?? null,
                  profile,
                }}
              />
              <div className="">
                <div className="text-emphasis max-w-64 truncate text-sm font-medium" title={email}>
                  {username || "No username"}
                </div>
                <div className="text-subtle text-xs leading-none">{timeZone}</div>
              </div>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return row.original.username?.toLowerCase().includes(value.toLowerCase()) || false;
        },
      },
      {
        id: "memberships",
        accessorFn: (data) => data.teamName,
        header: "Memberships",
        cell: ({ row }) => {
          const { teamName } = row.original;
          return <ReadOnlyDropdown teamName={teamName} />;
        },
      },
      {
        id: "timezone",
        accessorFn: (data) => data.timeZone,
        header: "Timezone",
        size: 160,
        cell: ({ row }) => {
          const { timeZone } = row.original;
          const timeRaw = dayjs().tz(timeZone);
          const time = timeRaw.format("HH:mm");
          const utcOffsetInMinutes = timeRaw.utcOffset();
          const hours = Math.abs(Math.floor(utcOffsetInMinutes / 60));
          const minutes = Math.abs(utcOffsetInMinutes % 60);
          const offsetFormatted = `${utcOffsetInMinutes < 0 ? "-" : "+"}${hours
            .toString()
            .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

          return (
            <div className="flex flex-col text-center">
              <span className="text-default text-sm font-medium">{time}</span>
              <span className="text-subtle text-xs leading-none">GMT {offsetFormatted}</span>
            </div>
          );
        },
      },
      {
        id: "slider",
        meta: {
          autoWidth: true,
        },
        header: () => {
          return (
            <div className="flex items-center justify-center space-x-2">
              <ButtonGroup containerProps={{ className: "space-x-0" }}>
                <Button
                  color="minimal"
                  variant="icon"
                  StartIcon="chevron-left"
                  onClick={() => setBrowsingDate(browsingDate.subtract(1, "day"))}
                />
                <Button
                  onClick={() => setBrowsingDate(browsingDate.add(1, "day"))}
                  color="minimal"
                  StartIcon="chevron-right"
                  variant="icon"
                />
              </ButtonGroup>
              <span>{browsingDate.format("LL")}</span>
            </div>
          );
        },
        cell: ({ row }) => {
          const { timeZone, dateRanges } = row.original;
          return <TimeDial timezone={timeZone} dateRanges={dateRanges} />;
        },
      }
    );

    return cols;
  }, [browsingDate, handleSelectAll, isMemberSelectEnabled]);

  //called on scroll and possibly on mount to fetch more data as the user scrolls and reaches bottom of table
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (scrollHeight - scrollTop - clientHeight < 300 && !isFetching && totalFetched < totalDBRowCount) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, totalFetched, totalDBRowCount]
  );

  useEffect(() => {
    fetchMoreOnBottomReached(tableContainerRef.current);
  }, [fetchMoreOnBottomReached]);

  const { t } = useLocale();
  const table = useReactTable({
    data: flatData,
    columns: memorisedColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  // This means they are not apart of any teams so we show the upgrade tip
  if (!flatData.length && !data?.pages?.[0]?.meta?.isApartOfAnyTeam) return <UpgradeTeamTip />;

  return (
    <TBContext.Provider
      value={createTimezoneBuddyStore({
        browsingDate: browsingDate.toDate(),
      })}>
      <>
        <GroupMeetingDialog isOpenDialog={isOpenDialog} setIsOpenDialog={setIsOpenDialog} link={meetingUrl} />

        <CellHighlightContainer>
          <DataTable
            table={table}
            tableContainerRef={tableContainerRef}
            onRowMouseclick={(row) => {
              if (isMemberSelectEnabled) {
                const { username } = row.original;
                handleSelectMember(username);
                row.toggleSelected();
                return;
              }
              setEditSheetOpen(true);
              setSelectedUser(row.original);
            }}
            isPending={isPending}
            onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}>
            <DataTableToolbar.Root>
              <div className="flex">
                <DataTableToolbar.SearchBar table={table} onSearch={(value) => setSearchString(value)} />
                <DataTableToolbar.CTA type="button" color="minimal">
                  {" "}
                  <div className="flex gap-2">
                    <div className="flex items-center  gap-2">
                      <label htmlFor="MemberSelect">{t("book_members")}</label>
                      <Switch
                        name="MemberSelect"
                        id="MemberSelect"
                        checked={isMemberSelectEnabled}
                        onCheckedChange={(value) => {
                          setIsMemberSelectEnabled(value);
                        }}
                      />
                    </div>
                    {isMemberSelectEnabled && <Button onClick={handleBookMembers}>Book</Button>}
                  </div>
                </DataTableToolbar.CTA>
              </div>
            </DataTableToolbar.Root>
          </DataTable>
        </CellHighlightContainer>
        {selectedUser && editSheetOpen ? (
          <AvailabilityEditSheet
            open={editSheetOpen}
            onOpenChange={(e) => {
              setEditSheetOpen(e);
              setSelectedUser(null); // We need to clear the user here or else the sheet will not re-render when opening a new user
            }}
            selectedUser={selectedUser}
          />
        ) : null}
      </>
    </TBContext.Provider>
  );
}
