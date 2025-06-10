import { keepPreviousData } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WEBAPP_URL } from "@calcom/lib/constants";
import { useDebounce } from "@calcom/lib/hooks/useDebounce";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import type { ActionType } from "@calcom/ui";
import {
  Avatar,
  Badge,
  Button,
  ConfirmationDialogContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DropdownActions,
  Icon,
  showToast,
  Table,
  TextField,
} from "@calcom/ui";

const { Cell, ColumnTitle, Header, Row } = Table;

const ITEMS_PER_PAGE = 25;
const SCROLL_THRESHOLD = 300;
const SEARCH_DELAY = 500;

interface UserDeletionDialogProps {
  user: number | null;
  onConfirm: () => void;
  onClose: () => void;
}

const UserDeletionDialog = ({ user, onConfirm, onClose }: UserDeletionDialogProps) => {
  return (
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- noop
    <Dialog name="delete-user" open={!!user} onOpenChange={(open) => (open ? () => {} : onClose())}>
      <ConfirmationDialogContent
        title="Delete User"
        confirmBtnText="Delete"
        cancelBtnText="Cancel"
        variety="danger"
        onConfirm={onConfirm}>
        <p>Are you sure you want to delete this user?</p>
      </ConfirmationDialogContent>
    </Dialog>
  );
};

function UsersTableBare() {
  const { t } = useLocale();
  const navigationRouter = useRouter();
  const scrollableContainer = useRef<HTMLDivElement>(null);
  const trpcUtils = trpc.useUtils();

  const [filterQuery, setFilterQuery] = useState<string>("");
  const [impersonationModalVisible, setImpersonationModalVisible] = useState(false);
  const [targetUser, setTargetUser] = useState<string | null>(null);
  const [userPendingDeletion, setUserPendingDeletion] = useState<number | null>(null);

  const debouncedFilterQuery = useDebounce(filterQuery, SEARCH_DELAY);

  const userDeletionMutation = trpc.viewer.users.delete.useMutation({
    onSuccess: async () => {
      showToast("User has been deleted", "success");
      trpcUtils.viewer.admin.listPaginated.setInfiniteData({ limit: ITEMS_PER_PAGE }, (cachedData) => {
        if (!cachedData) {
          return {
            pages: [],
            pageParams: [],
          };
        }
        return {
          ...cachedData,
          pages: cachedData.pages.map((page) => ({
            ...page,
            rows: page.rows.filter((row) => row.id !== userPendingDeletion),
          })),
        };
      });
    },
    onError: (err) => {
      console.error(err.message);
      showToast("There has been an error deleting this user.", "error");
    },
    onSettled: () => {
      setUserPendingDeletion(null);
    },
  });

  const paginatedUsersQuery = trpc.viewer.admin.listPaginated.useInfiniteQuery(
    {
      limit: ITEMS_PER_PAGE,
      searchTerm: debouncedFilterQuery,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    }
  );

  const passwordResetMutation = trpc.viewer.admin.sendPasswordReset.useMutation({
    onSuccess: () => {
      showToast("Password reset email has been sent", "success");
    },
  });

  const twoFactorRemovalMutation = trpc.viewer.admin.removeTwoFactor.useMutation({
    onSuccess: () => {
      showToast("2FA has been removed", "success");
    },
  });

  const accountLockMutation = trpc.viewer.admin.lockUserAccount.useMutation({
    onSuccess: ({ userId, locked }) => {
      showToast(locked ? "User was locked" : "User was unlocked", "success");
      trpcUtils.viewer.admin.listPaginated.setInfiniteData({ limit: ITEMS_PER_PAGE }, (cachedData) => {
        if (!cachedData) {
          return {
            pages: [],
            pageParams: [],
          };
        }
        return {
          ...cachedData,
          pages: cachedData.pages.map((page) => ({
            ...page,
            rows: page.rows.map((row) => {
              const updatedUser = row;
              if (row.id === userId) updatedUser.locked = locked;
              return updatedUser;
            }),
          })),
        };
      });
      trpcUtils.viewer.admin.listPaginated.invalidate();
    },
  });

  const executeUserImpersonation = async (username: string | null) => {
    await signIn("impersonation-auth", { redirect: false, username: username });
    navigationRouter.push(`/event-types`);
  };

  const aggregatedUserData = useMemo(
    () => paginatedUsersQuery.data?.pages?.flatMap((page) => page.rows) ?? [],
    [paginatedUsersQuery.data]
  );
  const totalRecordsCount = paginatedUsersQuery.data?.pages?.[0]?.meta?.totalRowCount ?? 0;
  const loadedRecordsCount = aggregatedUserData.length;

  const triggerLoadMoreOnScroll = useCallback(
    (containerElement?: HTMLDivElement | null) => {
      if (containerElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerElement;
        if (
          scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD &&
          !paginatedUsersQuery.isFetching &&
          loadedRecordsCount < totalRecordsCount
        ) {
          paginatedUsersQuery.fetchNextPage();
        }
      }
    },
    [paginatedUsersQuery.fetchNextPage, paginatedUsersQuery.isFetching, loadedRecordsCount, totalRecordsCount]
  );

  useEffect(() => {
    triggerLoadMoreOnScroll(scrollableContainer.current);
  }, [triggerLoadMoreOnScroll]);

  const initiatePasswordReset = (userId: number) => {
    passwordResetMutation.mutate({ userId });
  };

  const initiateUserImpersonation = (username: string | undefined) => {
    executeUserImpersonation(username || null);
  };

  const toggleAccountLock = (userId: number, currentLockStatus: boolean) => {
    accountLockMutation.mutate({ userId, locked: !currentLockStatus });
  };

  const openImpersonationModal = (username: string) => {
    setTargetUser(username);
    setImpersonationModalVisible(true);
  };

  const removeTwoFactorAuth = (userId: number) => {
    twoFactorRemovalMutation.mutate({ userId });
  };

  const scheduleUserDeletion = (userId: number) => {
    setUserPendingDeletion(userId);
  };

  const confirmUserDeletion = () => {
    if (!userPendingDeletion) return;
    userDeletionMutation.mutate({ userId: userPendingDeletion });
  };

  const handleSearchInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterQuery(event.target.value);
  };

  const handleScrollEvent = () => {
    triggerLoadMoreOnScroll(scrollableContainer.current);
  };

  const closeImpersonationModal = () => {
    setImpersonationModalVisible(false);
  };

  const handleImpersonationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await signIn("impersonation-auth", { redirect: false, username: targetUser });
    setImpersonationModalVisible(false);
    navigationRouter.replace("/settings/my-account/profile");
  };

  const generateUserActions = (user: any): ActionType[] => [
    {
      id: "edit",
      label: "Edit",
      actions: [
        {
          id: "edit-action",
          label: "Edit",
          href: `/settings/admin/users/${user.id}/edit`,
          icon: "pencil",
        },
      ],
    },
    {
      id: "reset-password",
      label: "Reset Password",
      onClick: () => initiatePasswordReset(user.id),
      icon: "lock",
    },
    {
      id: "impersonate-user",
      label: "Impersonate User",
      onClick: () => initiateUserImpersonation(user?.username),
      icon: "user",
    },
    {
      id: "lock-user",
      label: user.locked ? "Unlock User Account" : "Lock User Account",
      onClick: () => toggleAccountLock(user.id, user.locked),
      icon: "lock",
    },
    {
      id: "impersonation",
      label: "Impersonate",
      onClick: () => openImpersonationModal(user.username),
      icon: "venetian-mask",
    },
    {
      id: "remove-2fa",
      label: "Remove 2FA",
      color: "destructive",
      onClick: () => removeTwoFactorAuth(user.id),
      icon: "shield",
    },
    {
      id: "delete",
      label: "Delete",
      color: "destructive",
      onClick: () => scheduleUserDeletion(user.id),
      icon: "trash",
    },
  ];

  const renderUserRow = (user: any) => (
    <Row key={user.email}>
      <Cell widthClassNames="w-auto">
        <div className="min-h-10 flex ">
          <Avatar
            size="md"
            alt={`Avatar of ${user.username || "Nameless"}`}
            imageSrc={`${WEBAPP_URL}/${user.username}/avatar.png?orgId=${user.organizationId}`}
          />
          <div className="text-subtle ml-4 font-medium">
            <div className="flex flex-row">
              <span className="text-default">{user.name}</span>
              <span className="ml-3">/{user.username}</span>
              {user.locked && (
                <span className="ml-3">
                  <Icon name="lock" />
                </span>
              )}
              <br />
            </div>
            <span className="break-all">{user.email}</span>
          </div>
        </div>
      </Cell>
      <Cell>{user.timeZone}</Cell>
      <Cell>
        <Badge className="capitalize" variant={user.role === "ADMIN" ? "red" : "gray"}>
          {user.role.toLowerCase()}
        </Badge>
      </Cell>
      <Cell widthClassNames="w-auto">
        <div className="flex w-full justify-end">
          <DropdownActions actions={generateUserActions(user)} />
        </div>
      </Cell>
    </Row>
  );

  return (
    <div>
      <TextField placeholder="username or email" label="Search" onChange={handleSearchInput} />
      <div
        className="border-subtle rounded-md border"
        ref={scrollableContainer}
        onScroll={handleScrollEvent}
        style={{
          height: "calc(100vh - 30vh)",
          overflow: "auto",
        }}>
        <Table>
          <Header>
            <ColumnTitle widthClassNames="w-auto">User</ColumnTitle>
            <ColumnTitle>Timezone</ColumnTitle>
            <ColumnTitle>Role</ColumnTitle>
            <ColumnTitle widthClassNames="w-auto">
              <span className="sr-only">Edit</span>
            </ColumnTitle>
          </Header>
          <tbody className="divide-subtle divide-y rounded-md">{aggregatedUserData.map(renderUserRow)}</tbody>
        </Table>
        <UserDeletionDialog
          user={userPendingDeletion}
          onClose={() => setUserPendingDeletion(null)}
          onConfirm={confirmUserDeletion}
        />
      </div>
      {impersonationModalVisible && targetUser && (
        <Dialog open={impersonationModalVisible} onOpenChange={closeImpersonationModal}>
          <DialogContent type="creation" title={t("impersonate")} description={t("impersonation_user_tip")}>
            <form onSubmit={handleImpersonationSubmit}>
              <DialogFooter showDivider className="mt-8">
                <DialogClose color="secondary">{t("cancel")}</DialogClose>
                <Button color="primary" type="submit">
                  {t("impersonate")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export const UsersTable = UsersTableBare;
