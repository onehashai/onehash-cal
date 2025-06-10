import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import InviteLinkSettingsModal from "@calcom/features/oe/teams/components/InviteLinkSettingsModal";
import { MemberInvitationModalWithoutMembers } from "@calcom/features/oe/teams/components/MemberInvitationModal";
import classNames from "@calcom/lib/classNames";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { getTeamUrlSync } from "@calcom/lib/getBookerUrl/client";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRefreshData } from "@calcom/lib/hooks/useRefreshData";
import { MembershipRole } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import {
  Avatar,
  Badge,
  Button,
  ButtonGroup,
  ConfirmationDialogContent,
  Dialog,
  DialogTrigger,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  showToast,
  Tooltip,
} from "@calcom/ui";

import { TeamRole } from "./TeamPill";

interface Props {
  team: RouterOutputs["viewer"]["teams"]["list"][number];
  key: number;
  onActionSelect: (text: string) => void;
  isPending?: boolean;
  hideDropdown: boolean;
  setHideDropdown: (value: boolean) => void;
}

export default function TeamListItem(properties: Props) {
  const queryParams = useCompatSearchParams();
  const localeContext = useLocale();
  const trpcUtils = trpc.useUtils();
  const currentUser = trpc.viewer.me.useQuery().data;
  const teamData = properties.team;

  const shouldShowModal = queryParams?.get("inviteModal") === "true";
  const [memberInviteModalOpen, setMemberInviteModalOpen] = useState(shouldShowModal);
  const [inviteLinkSettingsOpen, setInviteLinkSettingsOpen] = useState(false);
  const dataRefresher = useRefreshData();

  const membershipMutation = trpc.viewer.teams.acceptOrLeave.useMutation({
    onSuccess: (response, inputVariables) => {
      showToast(localeContext.t("success"), "success");
      Promise.all([
        trpcUtils.viewer.teams.get.invalidate(),
        trpcUtils.viewer.teams.list.invalidate(),
        trpcUtils.viewer.teams.hasTeamPlan.invalidate(),
        trpcUtils.viewer.teams.listInvites.invalidate(),
      ]);
      const organizationIdForUser = currentUser?.profile?.organization?.id;
      const belongsToOtherOrgSubTeam = teamData.parentId ? teamData.parentId != organizationIdForUser : false;
      const isOtherOrganization = teamData.isOrganization && teamData.id !== organizationIdForUser;
      if (inputVariables.accept && (belongsToOtherOrgSubTeam || isOtherOrganization)) {
        dataRefresher();
      }
    },
  });

  const handleMembershipAction = (shouldAccept: boolean) => {
    membershipMutation.mutate({
      teamId: teamData?.id as number,
      accept: shouldAccept,
    });
  };

  const confirmInvitation = () => handleMembershipAction(true);
  const rejectInvitation = () => handleMembershipAction(false);

  const hasOwnerRole = properties.team.role === MembershipRole.OWNER;
  const isPendingMember = !properties.team.accepted;
  const hasAdminPrivileges =
    properties.team.role === MembershipRole.OWNER || properties.team.role === MembershipRole.ADMIN;
  const { hideDropdown: dropdownHidden, setHideDropdown: updateDropdownVisibility } = properties;

  const closeInvitationModal = () => {
    setMemberInviteModalOpen(false);
  };

  if (!teamData) return <></>;

  const generatedTeamUrl = teamData.isOrganization
    ? getTeamUrlSync({ orgSlug: teamData.slug, teamSlug: null })
    : getTeamUrlSync({ orgSlug: teamData.parent ? teamData.parent.slug : null, teamSlug: teamData.slug });

  const teamDisplayInfo = (
    <div className="item-center flex px-5 py-5">
      <Avatar
        size="md"
        imageSrc={getPlaceholderAvatar(
          teamData?.logoUrl || teamData?.parent?.logoUrl,
          teamData?.name as string
        )}
        alt="Team logo"
        className="inline-flex justify-center"
      />
      <div className="ms-3 inline-block truncate">
        <span className="text-default text-sm font-bold">{teamData.name}</span>
        <span className="text-muted block text-xs">
          {teamData.slug ? `${generatedTeamUrl}` : <Badge>{localeContext.t("upgrade")}</Badge>}
        </span>
      </div>
    </div>
  );

  return (
    <li>
      <MemberInvitationModalWithoutMembers
        hideInvitationModal={closeInvitationModal}
        showMemberInvitationModal={memberInviteModalOpen}
        teamId={teamData.id}
        token={teamData.inviteToken?.token}
        onSettingsOpen={() => setInviteLinkSettingsOpen(true)}
      />
      {teamData.inviteToken && (
        <InviteLinkSettingsModal
          isOpen={inviteLinkSettingsOpen}
          teamId={teamData.id}
          token={teamData.inviteToken?.token}
          expiresInDays={teamData.inviteToken?.expiresInDays || undefined}
          onExit={() => {
            setInviteLinkSettingsOpen(false);
            setMemberInviteModalOpen(true);
          }}
        />
      )}
      <div
        className={classNames(
          "flex items-center  justify-between",
          !isPendingMember && "hover:bg-muted group"
        )}>
        {!isPendingMember ? (
          teamData.slug ? (
            <Link
              data-testid="team-list-item-link"
              href={`/settings/teams/${teamData.id}/profile`}
              className="flex-grow cursor-pointer truncate text-sm"
              title={`${teamData.name}`}>
              {teamDisplayInfo}
            </Link>
          ) : (
            <TeamActivationSection teamIdentifier={teamData.id}>{teamDisplayInfo}</TeamActivationSection>
          )
        ) : (
          teamDisplayInfo
        )}
        <div className="px-5 py-5">
          {isPendingMember ? (
            <>
              <div className="hidden justify-center sm:flex">
                <Button type="button" color="secondary" onClick={rejectInvitation}>
                  {localeContext.t("reject")}
                </Button>
                <Button
                  type="button"
                  color="secondary"
                  data-testid={`accept-invitation-${teamData.id}`}
                  StartIcon="check"
                  className="me-2 ms-2"
                  onClick={confirmInvitation}>
                  {localeContext.t("accept")}
                </Button>
              </div>
              <div className="block sm:hidden">
                <Dropdown>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" color="minimal" variant="icon" StartIcon="ellipsis" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <DropdownItem type="button" StartIcon="check" onClick={confirmInvitation}>
                        {localeContext.t("accept")}
                      </DropdownItem>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <DropdownItem
                        color="destructive"
                        type="button"
                        StartIcon="x"
                        onClick={rejectInvitation}>
                        {localeContext.t("reject")}
                      </DropdownItem>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </Dropdown>
              </div>
            </>
          ) : (
            <div className="flex space-x-2 rtl:space-x-reverse">
              <TeamRole role={teamData.role} />
              <ButtonGroup combined>
                {teamData.slug && (
                  <Tooltip content={localeContext.t("copy_link_team")}>
                    <Button
                      color="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${getTeamUrlSync({
                            orgSlug: teamData.parent ? teamData.parent.slug : null,
                            teamSlug: teamData.slug,
                          })}`
                        );
                        showToast(localeContext.t("link_copied"), "success");
                      }}
                      variant="icon"
                      StartIcon="link"
                    />
                  </Tooltip>
                )}
                <Dropdown>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="radix-state-open:rounded-r-md"
                      type="button"
                      color="secondary"
                      variant="icon"
                      StartIcon="ellipsis"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent hidden={dropdownHidden}>
                    {hasAdminPrivileges && (
                      <DropdownMenuItem>
                        <DropdownItem
                          type="button"
                          href={`/settings/teams/${teamData.id}/profile`}
                          StartIcon="pencil">
                          {localeContext.t("edit_team") as string}
                        </DropdownItem>
                      </DropdownMenuItem>
                    )}
                    {!teamData.slug && <TeamActivationButton teamIdentifier={teamData.id} />}
                    {teamData.slug && (
                      <DropdownMenuItem>
                        <DropdownItem
                          type="button"
                          target="_blank"
                          href={`${getTeamUrlSync({
                            orgSlug: teamData.parent ? teamData.parent.slug : null,
                            teamSlug: teamData.slug,
                          })}`}
                          StartIcon="external-link">
                          {localeContext.t("preview_team") as string}
                        </DropdownItem>
                      </DropdownMenuItem>
                    )}
                    {hasAdminPrivileges && (
                      <DropdownMenuItem>
                        <DropdownItem
                          type="button"
                          onClick={() => {
                            setMemberInviteModalOpen(true);
                          }}
                          StartIcon="send">
                          {localeContext.t("invite_team_member") as string}
                        </DropdownItem>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {hasOwnerRole && (
                      <DropdownMenuItem>
                        <Dialog open={dropdownHidden} onOpenChange={updateDropdownVisibility}>
                          <DialogTrigger asChild>
                            <DropdownItem
                              color="destructive"
                              type="button"
                              StartIcon="trash"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}>
                              {localeContext.t("disband_team")}
                            </DropdownItem>
                          </DialogTrigger>
                          <ConfirmationDialogContent
                            variety="danger"
                            title={localeContext.t("disband_team")}
                            confirmBtnText={localeContext.t("confirm_disband_team")}
                            isPending={properties.isPending}
                            onConfirm={() => {
                              properties.onActionSelect("disband");
                            }}>
                            {localeContext.t("disband_team_confirmation_message")}
                          </ConfirmationDialogContent>
                        </Dialog>
                      </DropdownMenuItem>
                    )}

                    {!hasOwnerRole && (
                      <DropdownMenuItem>
                        <Dialog>
                          <DialogTrigger asChild>
                            <DropdownItem
                              color="destructive"
                              type="button"
                              StartIcon="log-out"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}>
                              {localeContext.t("leave_team")}
                            </DropdownItem>
                          </DialogTrigger>
                          <ConfirmationDialogContent
                            variety="danger"
                            title={localeContext.t("leave_team")}
                            confirmBtnText={localeContext.t("confirm_leave_team")}
                            onConfirm={rejectInvitation}>
                            {localeContext.t("leave_team_confirmation_message")}
                          </ConfirmationDialogContent>
                        </Dialog>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </Dropdown>
              </ButtonGroup>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

const TeamActivationButton = ({ teamIdentifier }: { teamIdentifier: number }) => {
  const localeContext = useLocale();
  const navigationRouter = useRouter();
  const teamPublishingMutation = trpc.viewer.teams.publish.useMutation({
    onSuccess(result) {
      navigationRouter.push(result.url);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  return (
    <DropdownMenuItem>
      <DropdownItem
        type="button"
        onClick={() => {
          teamPublishingMutation.mutate({ teamId: teamIdentifier });
        }}
        StartIcon="globe">
        {localeContext.t("team_publish")}
      </DropdownItem>
    </DropdownMenuItem>
  );
};

const TeamActivationSection = ({
  children,
  teamIdentifier,
}: {
  children: React.ReactNode;
  teamIdentifier: number;
}) => {
  const navigationRouter = useRouter();
  const teamPublishingMutation = trpc.viewer.teams.publish.useMutation({
    onSuccess(result) {
      navigationRouter.push(result.url);
    },
    onError: (err) => {
      showToast(err.message, "error");
    },
  });

  return (
    <button
      className="block flex-grow cursor-pointer truncate text-left text-sm"
      type="button"
      onClick={() => {
        teamPublishingMutation.mutate({ teamId: teamIdentifier });
      }}>
      {children}
    </button>
  );
};
