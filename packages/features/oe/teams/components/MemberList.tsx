"use client";

import { keepPreviousData } from "@tanstack/react-query";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getFacetedUniqueValues,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import classNames from "classnames";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  DataTable,
  DataTableToolbar,
  DataTableFilters,
  DataTableSelectionBar,
  useFetchMoreOnBottomReached,
} from "@calcom/features/data-table";
import { useOrgBranding } from "@calcom/features/ee/organizations/context/provider";
import { DynamicLink } from "@calcom/features/users/components/UserTable/BulkActions/DynamicLink";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc";
import type { RouterOutputs } from "@calcom/trpc/react";
import {
  Avatar,
  Badge,
  Button,
  ButtonGroup,
  Checkbox,
  ConfirmationDialogContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  Dropdown,
  DropdownItem,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  showToast,
  Tooltip,
} from "@calcom/ui";

import DeleteBulkTeamMembers from "./DeleteBulkTeamMembers";
import { EditMemberSheet } from "./EditMemberSheet";
import { EventTypesList } from "./EventTypesList";
import TeamAvailabilityModal from "./TeamAvailabilityModal";

interface Props {
  team: NonNullable<RouterOutputs["viewer"]["teams"]["get"]>;
  isOrgAdminOrOwner: boolean | undefined;
  setShowMemberInvitationModal: Dispatch<SetStateAction<boolean>>;
}

export type User = RouterOutputs["viewer"]["teams"]["listMembers"]["members"][number];

function verifyIsOrganization(teamData: Props["team"]) {
  return Boolean(teamData.isOrganization);
}

type Payload = {
  showModal: boolean;
  user?: User;
};

export type State = {
  deleteMember: Payload;
  impersonateMember: Payload;
  editSheet: Payload;
  teamAvailability: Payload;
};

export type Action =
  | {
      type:
        | "SET_DELETE_ID"
        | "SET_IMPERSONATE_ID"
        | "EDIT_USER_SHEET"
        | "TEAM_AVAILABILITY"
        | "INVITE_MEMBER";
      payload: Payload;
    }
  | {
      type: "CLOSE_MODAL";
    };

const defaultStateValues: State = {
  deleteMember: {
    showModal: false,
  },
  impersonateMember: {
    showModal: false,
  },
  editSheet: {
    showModal: false,
  },
  teamAvailability: {
    showModal: false,
  },
};

const defaultColumnStates = {
  select: true,
  member: true,
  role: true,
  teams: true,
  actions: true,
};

function stateReducer(currentState: State, actionData: Action): State {
  if (actionData.type === "SET_DELETE_ID") {
    return Object.assign({}, currentState, { deleteMember: actionData.payload });
  } else if (actionData.type === "SET_IMPERSONATE_ID") {
    return Object.assign({}, currentState, { impersonateMember: actionData.payload });
  } else if (actionData.type === "EDIT_USER_SHEET") {
    return Object.assign({}, currentState, { editSheet: actionData.payload });
  } else if (actionData.type === "TEAM_AVAILABILITY") {
    return Object.assign({}, currentState, { teamAvailability: actionData.payload });
  } else if (actionData.type === "CLOSE_MODAL") {
    const resetState = {
      deleteMember: { showModal: false },
      impersonateMember: { showModal: false },
      editSheet: { showModal: false },
      teamAvailability: { showModal: false },
    };
    return Object.assign({}, currentState, resetState);
  }
  return currentState;
}

export default function MemberList(properties: Props) {
  const [isDynamicLinkActive, updateDynamicLinkState] = useQueryState("dynamicLink", parseAsBoolean);
  const localizationHooks = useLocale();
  const sessionInfo = useSession();

  const trpcHelpers = trpc.useUtils();
  const organizationBrand = useOrgBranding();
  const baseUrl = organizationBrand?.fullDomain || WEBAPP_URL;

  const scrollContainerElement = useRef<HTMLDivElement>(null);
  const [modalState, updateModalState] = useReducer(stateReducer, defaultStateValues);
  const [searchQuery, updateSearchQuery] = useState("");

  const membersQuery = trpc.viewer.teams.listMembers.useInfiniteQuery(
    {
      limit: 10,
      searchTerm: searchQuery,
      teamId: properties.team.id,
    },
    {
      enabled: Boolean(properties.team.id),
      getNextPageParam: function (lastPageData) {
        return lastPageData.nextCursor;
      },
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    }
  );

  const [activeFilters, modifyActiveFilters] = useState<ColumnFiltersState>([]);
  const [selectedRows, modifySelectedRows] = useState({});

  function updateMemberCache(params: {
    utils: ReturnType<typeof trpc.useUtils>;
    memberId: number;
    teamId: number;
    searchTerm: string;
  }) {
    params.utils.viewer.teams.listMembers.setInfiniteData(
      {
        limit: 10,
        teamId: params.teamId,
        searchTerm: params.searchTerm,
      },
      function (existingData) {
        if (!existingData) {
          return {
            pages: [],
            pageParams: [],
          };
        }

        const updatedPages = existingData.pages.map(function (singlePage) {
          const filteredMembers = singlePage.members.filter(function (member) {
            return member.id !== params.memberId;
          });

          return Object.assign({}, singlePage, { members: filteredMembers });
        });

        return Object.assign({}, existingData, { pages: updatedPages });
      }
    );
  }

  const deleteMemberAction = trpc.viewer.teams.removeMember.useMutation({
    onMutate: async function (mutationParams) {
      await trpcHelpers.viewer.teams.listMembers.cancel();

      const cachedData = trpcHelpers.viewer.teams.listMembers.getInfiniteData({
        limit: 10,
        teamId: mutationParams.teamIds[0],
        searchTerm: searchQuery,
      });

      if (cachedData && modalState.deleteMember.user?.id) {
        updateMemberCache({
          utils: trpcHelpers,
          memberId: modalState.deleteMember.user.id,
          teamId: mutationParams.teamIds[0],
          searchTerm: searchQuery,
        });
      }

      return { previousValue: cachedData };
    },
    onSuccess: async function () {
      await Promise.all([
        trpcHelpers.viewer.teams.get.invalidate(),
        trpcHelpers.viewer.eventTypes.invalidate(),
        trpcHelpers.viewer.organizations.listMembers.invalidate(),
        trpcHelpers.viewer.organizations.getMembers.invalidate(),
      ]);
      showToast(localizationHooks.t("success"), "success");
    },
    onError: function (errorInfo) {
      showToast(errorInfo.message, "error");
    },
  });

  const resendInviteAction = trpc.viewer.teams.resendInvitation.useMutation({
    onSuccess: function () {
      showToast(localizationHooks.t("invitation_resent"), "success");
    },
    onError: function (errorData) {
      showToast(errorData.message, "error");
    },
  });

  const userIsAdminOrOwner =
    properties.team.membership.role === MembershipRole.OWNER ||
    properties.team.membership.role === MembershipRole.ADMIN;

  function executeRemoveMember() {
    if (!modalState.deleteMember.user?.id) return;

    deleteMemberAction.mutate({
      teamIds: [properties.team.id],
      memberIds: [modalState.deleteMember.user.id],
      isOrg: verifyIsOrganization(properties.team),
    });
  }

  const totalMembersCount = membersQuery.data?.pages?.[0]?.meta?.totalRowCount || 0;

  const tableColumnDefinitions = useMemo(
    function () {
      const columnDefs: ColumnDef<User>[] = [
        {
          id: "select",
          enableHiding: false,
          enableSorting: false,
          size: 30,
          header: function (headerProps) {
            return (
              <Checkbox
                checked={headerProps.table.getIsAllPageRowsSelected()}
                onCheckedChange={function (checkValue) {
                  headerProps.table.toggleAllPageRowsSelected(Boolean(checkValue));
                }}
                aria-label="Select all"
                className="translate-y-[2px]"
              />
            );
          },
          cell: function (cellProps) {
            return (
              <Checkbox
                checked={cellProps.row.getIsSelected()}
                onCheckedChange={function (checkValue) {
                  cellProps.row.toggleSelected(Boolean(checkValue));
                }}
                aria-label="Select row"
                className="translate-y-[2px]"
              />
            );
          },
        },
        {
          id: "member",
          accessorFn: function (rowData) {
            return rowData.email;
          },
          enableHiding: false,
          header: `Member (${totalMembersCount})`,
          size: 250,
          cell: function (cellData) {
            const memberInfo = cellData.row.original;
            const displayName =
              memberInfo.name ||
              (function () {
                const emailPrefix = memberInfo.email.split("@")[0];
                return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
              })();

            return (
              <div className="flex items-center gap-2">
                <Avatar
                  size="sm"
                  alt={memberInfo.username || memberInfo.email}
                  imageSrc={getUserAvatarUrl({
                    avatarUrl: memberInfo.avatarUrl,
                  })}
                />
                <div data-testid={`member-${memberInfo.username}`}>
                  <div data-testid="member-name" className="text-emphasis text-sm font-medium leading-none">
                    {displayName}
                  </div>
                  <div
                    data-testid={
                      memberInfo.accepted
                        ? "member-email"
                        : `email-${memberInfo.email.replace("@", "")}-pending`
                    }
                    className="text-subtle mt-1 text-sm leading-none">
                    {memberInfo.email}
                  </div>
                </div>
              </div>
            );
          },
          filterFn: function (rowData, columnId, filterData) {
            const emailAddress = rowData.original.email;
            return filterData.indexOf(emailAddress) !== -1;
          },
        },
        {
          id: "role",
          accessorFn: function (rowData) {
            return rowData.role;
          },
          header: "Role",
          size: 100,
          cell: function (cellData) {
            const memberData = cellData.row.original;
            return (
              <div className="flex h-full flex-wrap items-center gap-2">
                {!memberData.accepted && (
                  <Badge
                    data-testid="member-pending"
                    variant="orange"
                    className="text-xs"
                    onClick={function () {
                      cellData.table.getColumn("role")?.setFilterValue(["PENDING"]);
                    }}>
                    Pending
                  </Badge>
                )}
                <Badge
                  data-testid="member-role"
                  variant={memberData.role === "MEMBER" ? "gray" : "blue"}
                  onClick={function () {
                    cellData.table.getColumn("role")?.setFilterValue([memberData.role]);
                  }}>
                  {memberData.role}
                </Badge>
              </div>
            );
          },
          filterFn: function (rowData, columnId, filterData) {
            const isPendingIncluded = filterData.indexOf("PENDING") !== -1;

            if (isPendingIncluded) {
              if (filterData.length === 1) {
                return !rowData.original.accepted;
              } else {
                return !rowData.original.accepted || filterData.indexOf(rowData.getValue(columnId)) !== -1;
              }
            }

            return filterData.indexOf(rowData.getValue(columnId)) !== -1;
          },
        },
        {
          id: "lastActiveAt",
          header: "Last Active",
          cell: function (cellData) {
            return <div>{cellData.row.original.lastActiveAt}</div>;
          },
        },
        {
          id: "actions",
          size: 80,
          meta: {
            sticky: { position: "right" },
          },
          cell: function (cellData) {
            const memberRecord = cellData.row.original;
            const isCurrentUser = memberRecord.id === sessionInfo?.data?.user.id;

            const canEditMember =
              (properties.team.membership?.role === MembershipRole.OWNER &&
                (memberRecord.role !== MembershipRole.OWNER || !isCurrentUser)) ||
              (properties.team.membership?.role === MembershipRole.ADMIN &&
                memberRecord.role !== MembershipRole.OWNER) ||
              properties.isOrgAdminOrOwner;

            const canImpersonate =
              canEditMember &&
              !memberRecord.disableImpersonation &&
              memberRecord.accepted &&
              process.env.NEXT_PUBLIC_TEAM_IMPERSONATION === "true";

            const canResendInvite = canEditMember && !memberRecord.accepted;

            return (
              <>
                {properties.team.membership?.accepted && (
                  <div className="flex items-center justify-end">
                    <ButtonGroup combined containerProps={{ className: "border-default hidden md:flex" }}>
                      {Boolean(memberRecord.accepted) && (
                        <Tooltip content={localizationHooks.t("view_public_page")}>
                          <Button
                            target="_blank"
                            href={`${memberRecord.bookerUrl}/${memberRecord.username}`}
                            color="secondary"
                            className={classNames(!canEditMember ? "rounded-r-md" : "")}
                            variant="icon"
                            StartIcon="external-link"
                            disabled={!memberRecord.accepted}
                          />
                        </Tooltip>
                      )}
                      {canEditMember && (
                        <Dropdown>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="radix-state-open:rounded-r-md"
                              color="secondary"
                              variant="icon"
                              StartIcon="ellipsis"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuContent>
                              <DropdownMenuItem>
                                <DropdownItem
                                  type="button"
                                  onClick={function () {
                                    updateModalState({
                                      type: "EDIT_USER_SHEET",
                                      payload: {
                                        user: memberRecord,
                                        showModal: true,
                                      },
                                    });
                                  }}
                                  StartIcon="pencil">
                                  {localizationHooks.t("edit")}
                                </DropdownItem>
                              </DropdownMenuItem>
                              {canImpersonate && (
                                <>
                                  <DropdownMenuItem>
                                    <DropdownItem
                                      type="button"
                                      onClick={function () {
                                        updateModalState({
                                          type: "SET_IMPERSONATE_ID",
                                          payload: {
                                            user: memberRecord,
                                            showModal: true,
                                          },
                                        });
                                      }}
                                      StartIcon="lock">
                                      {localizationHooks.t("impersonate")}
                                    </DropdownItem>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {canResendInvite && (
                                <DropdownMenuItem>
                                  <DropdownItem
                                    type="button"
                                    onClick={function () {
                                      resendInviteAction.mutate({
                                        teamId: properties.team.id,
                                        email: memberRecord.email,
                                        language: localizationHooks.i18n.language,
                                      });
                                    }}
                                    StartIcon="send">
                                    {localizationHooks.t("resend_invitation")}
                                  </DropdownItem>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <DropdownItem
                                  type="button"
                                  onClick={function () {
                                    updateModalState({
                                      type: "SET_DELETE_ID",
                                      payload: {
                                        user: memberRecord,
                                        showModal: true,
                                      },
                                    });
                                  }}
                                  color="destructive"
                                  StartIcon="user-x">
                                  {localizationHooks.t("remove")}
                                </DropdownItem>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenuPortal>
                        </Dropdown>
                      )}
                    </ButtonGroup>
                    <div className="flex md:hidden">
                      <Dropdown>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="icon" color="minimal" StartIcon="ellipsis" />
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuContent>
                            <DropdownMenuItem className="outline-none">
                              <DropdownItem
                                disabled={!memberRecord.accepted}
                                href={!memberRecord.accepted ? undefined : `/${memberRecord.username}`}
                                target="_blank"
                                type="button"
                                StartIcon="external-link">
                                {localizationHooks.t("view_public_page")}
                              </DropdownItem>
                            </DropdownMenuItem>
                            {canEditMember && (
                              <>
                                <DropdownMenuItem>
                                  <DropdownItem
                                    type="button"
                                    onClick={function () {
                                      updateModalState({
                                        type: "EDIT_USER_SHEET",
                                        payload: {
                                          user: memberRecord,
                                          showModal: true,
                                        },
                                      });
                                    }}
                                    StartIcon="pencil">
                                    {localizationHooks.t("edit")}
                                  </DropdownItem>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <DropdownItem
                                    type="button"
                                    color="destructive"
                                    onClick={function () {
                                      updateModalState({
                                        type: "SET_DELETE_ID",
                                        payload: {
                                          user: memberRecord,
                                          showModal: true,
                                        },
                                      });
                                    }}
                                    StartIcon="user-x">
                                    {localizationHooks.t("remove")}
                                  </DropdownItem>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenuPortal>
                      </Dropdown>
                    </div>
                  </div>
                )}
              </>
            );
          },
        },
      ];

      return columnDefs;
    },
    [properties.isOrgAdminOrOwner, updateModalState, totalMembersCount, sessionInfo?.data?.user.id]
  );

  const processedMemberData = useMemo(
    function () {
      if (!membersQuery.data?.pages) return [];

      const allMembers: User[] = [];
      membersQuery.data.pages.forEach(function (page) {
        allMembers.push(...page.members);
      });

      return allMembers;
    },
    [membersQuery.data]
  ) as User[];

  const currentFetchedCount = processedMemberData.length;

  const dataTable = useReactTable({
    data: processedMemberData,
    columns: tableColumnDefinitions,
    enableRowSelection: true,
    debugTable: true,
    manualPagination: true,
    initialState: {
      columnVisibility: defaultColumnStates,
    },
    state: {
      columnFilters: activeFilters,
      rowSelection: selectedRows,
    },
    onColumnFiltersChange: modifyActiveFilters,
    onRowSelectionChange: modifySelectedRows,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: function (memberRow) {
      return String(memberRow.id);
    },
  });

  const infiniteScrollHandler = useFetchMoreOnBottomReached(
    scrollContainerElement,
    membersQuery.fetchNextPage,
    membersQuery.isFetching,
    currentFetchedCount,
    totalMembersCount
  );

  const selectionCount = dataTable.getSelectedRowModel().rows.length;

  return (
    <>
      <DataTable
        data-testid="team-member-list-container"
        table={dataTable}
        tableContainerRef={scrollContainerElement}
        isPending={membersQuery.isPending}
        onScroll={function (scrollEvent) {
          infiniteScrollHandler(scrollEvent.target as HTMLDivElement);
        }}>
        <DataTableToolbar.Root>
          <div className="flex w-full gap-2">
            <DataTableToolbar.SearchBar
              table={dataTable}
              onSearch={function (searchValue) {
                updateSearchQuery(searchValue);
              }}
            />
            <DataTableFilters.FilterButton table={dataTable} />
            <DataTableFilters.ColumnVisibilityButton table={dataTable} />
            {userIsAdminOrOwner && (
              <DataTableToolbar.CTA
                type="button"
                color="primary"
                StartIcon="plus"
                className="rounded-md"
                onClick={function () {
                  properties.setShowMemberInvitationModal(true);
                }}
                data-testid="new-member-button">
                {localizationHooks.t("add")}
              </DataTableToolbar.CTA>
            )}
          </div>
          <div className="flex gap-2 justify-self-start">
            <DataTableFilters.ActiveFilters table={dataTable} />
          </div>
        </DataTableToolbar.Root>

        {selectionCount >= 2 && isDynamicLinkActive && (
          <DataTableSelectionBar.Root className="!bottom-16 md:!bottom-20">
            <DynamicLink table={dataTable} domain={baseUrl} />
          </DataTableSelectionBar.Root>
        )}
        {selectionCount > 0 && (
          <DataTableSelectionBar.Root className="justify-center">
            <p className="text-brand-subtle px-2 text-center text-xs leading-none sm:text-sm sm:font-medium">
              {localizationHooks.t("number_selected", { count: selectionCount })}
            </p>
            {selectionCount >= 2 && (
              <DataTableSelectionBar.Button
                onClick={function () {
                  updateDynamicLinkState(!isDynamicLinkActive);
                }}
                icon="handshake">
                {localizationHooks.t("group_meeting")}
              </DataTableSelectionBar.Button>
            )}
            <EventTypesList table={dataTable} teamId={properties.team.id} />
            <DeleteBulkTeamMembers
              users={dataTable.getSelectedRowModel().flatRows.map(function (rowItem) {
                return rowItem.original;
              })}
              onRemove={function () {
                dataTable.toggleAllPageRowsSelected(false);
              }}
              isOrg={verifyIsOrganization(properties.team)}
              teamId={properties.team.id}
            />
          </DataTableSelectionBar.Root>
        )}
      </DataTable>
      {modalState.deleteMember.showModal && (
        <Dialog
          open={true}
          onOpenChange={function (openState) {
            if (!openState) {
              updateModalState({
                type: "CLOSE_MODAL",
              });
            }
          }}>
          <ConfirmationDialogContent
            variety="danger"
            title={localizationHooks.t("remove_member")}
            confirmBtnText={localizationHooks.t("confirm_remove_member")}
            onConfirm={executeRemoveMember}>
            {localizationHooks.t("remove_member_confirmation_message")}
          </ConfirmationDialogContent>
        </Dialog>
      )}

      {modalState.impersonateMember.showModal && modalState.impersonateMember.user?.username && (
        <Dialog
          open={true}
          onOpenChange={function () {
            updateModalState({
              type: "CLOSE_MODAL",
            });
          }}>
          <DialogContent
            type="creation"
            title={localizationHooks.t("impersonate")}
            description={localizationHooks.t("impersonation_user_tip")}>
            <form
              onSubmit={async function (submitEvent) {
                submitEvent.preventDefault();
                await signIn("impersonation-auth", {
                  username: modalState.impersonateMember.user?.email,
                  teamId: properties.team.id,
                });
                updateModalState({
                  type: "CLOSE_MODAL",
                });
              }}>
              <DialogFooter showDivider className="mt-8">
                <DialogClose color="secondary">{localizationHooks.t("cancel")}</DialogClose>
                <Button color="primary" type="submit">
                  {localizationHooks.t("impersonate")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {modalState.teamAvailability.showModal && (
        <Dialog
          open={true}
          onOpenChange={function () {
            updateModalState({
              type: "CLOSE_MODAL",
            });
          }}>
          <DialogContent type="creation" size="md">
            <TeamAvailabilityModal team={properties.team} member={modalState.teamAvailability.user} />
          </DialogContent>
        </Dialog>
      )}
      {modalState.editSheet.showModal && (
        <EditMemberSheet
          dispatch={updateModalState}
          state={modalState}
          currentMember={properties.team.membership.role}
          teamId={properties.team.id}
        />
      )}
    </>
  );
}
