// eslint-disable-next-line no-restricted-imports
import { useEffect, useState, Fragment } from "react";

import { useTeamInvites } from "@calcom/lib/hooks/useHasPaidPlan";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button, showToast, TopBanner, Icon } from "@calcom/ui";

const TeamInviteBanner = function () {
  const localizationMethods = useLocale();

  const [displayBadgeStatus, updateDisplayBadgeStatus] = useState(false);
  const [activeTeamIdentifiers, updateActiveTeamIdentifiers] = useState<number[]>([]);
  const [dismissedInvitations, updateDismissedInvitations] = useState<number[]>([]);

  const teamInviteData = useTeamInvites();
  const apiHelpers = trpc.useUtils();

  const teamResponseMutation = trpc.viewer.teams.acceptOrLeave.useMutation({
    onSuccess: function () {
      showToast(localizationMethods.t("success"), "success");
      apiHelpers.viewer.teams.get.invalidate();
      apiHelpers.viewer.teams.list.invalidate();
      apiHelpers.viewer.teams.hasTeamPlan.invalidate();
      apiHelpers.viewer.teams.listInvites.invalidate();
    },
  });

  useEffect(
    function () {
      const isLoading = teamInviteData.isPending;
      const inviteList = teamInviteData.listInvites;

      if (isLoading || !inviteList || inviteList.length === 0) {
        return;
      }

      const storedDisabledNotifications = localStorage.getItem("disabledTeamNotifications");
      let previouslyDismissed: number[] = [];

      if (storedDisabledNotifications) {
        previouslyDismissed = JSON.parse(storedDisabledNotifications);
      }

      const visibleTeamIds: number[] = [];

      for (let i = 0; i < inviteList.length; i++) {
        const currentTeamId = inviteList[i].teamId;
        const isNotDismissed = previouslyDismissed.indexOf(currentTeamId) === -1;

        if (isNotDismissed) {
          visibleTeamIds.push(currentTeamId);
        }
      }

      updateDismissedInvitations(previouslyDismissed);
      updateActiveTeamIdentifiers(visibleTeamIds);
      updateDisplayBadgeStatus(visibleTeamIds.length > 0);
    },
    [teamInviteData.listInvites, teamInviteData.isPending]
  );

  const processTeamResponse = function (shouldAccept: boolean, targetTeamId: number) {
    teamResponseMutation.mutate({
      teamId: targetTeamId,
      accept: shouldAccept,
    });
  };

  const dismissInvitation = function (targetTeamId: number) {
    const newDismissedList = dismissedInvitations.concat(targetTeamId);
    updateDismissedInvitations(newDismissedList);

    const remainingInvites =
      teamInviteData.listInvites
        ?.map(function (invitation) {
          return invitation.teamId;
        })
        .filter(function (id) {
          return id !== targetTeamId;
        }) ?? [];

    updateActiveTeamIdentifiers(remainingInvites);
    localStorage.setItem("disabledTeamNotifications", JSON.stringify(newDismissedList));
  };

  if (displayBadgeStatus === false) {
    return null;
  }

  const renderInvitationBanner = function (
    invitation: NonNullable<typeof teamInviteData.listInvites>[number]
  ) {
    const shouldShowBanner = activeTeamIdentifiers.indexOf(invitation.teamId) !== -1;

    if (!shouldShowBanner) {
      return null;
    }

    const actionButtons = (
      <div className="flex gap-2">
        <Button
          color="minimal"
          className="border"
          onClick={function () {
            processTeamResponse(true, invitation.teamId);
          }}>
          Accept
        </Button>
        <Button
          color="minimal"
          className="border"
          onClick={function () {
            processTeamResponse(false, invitation.teamId);
          }}>
          Decline
        </Button>
        <Button
          color="minimal"
          onClick={function () {
            dismissInvitation(invitation.teamId);
          }}>
          <Icon name="x" />
        </Button>
      </div>
    );

    return (
      <TopBanner
        key={invitation.teamId}
        text={localizationMethods.t("pending_invites_team", { teamName: invitation.team.name })}
        variant="warning"
        actions={actionButtons}
      />
    );
  };

  const bannerElements = teamInviteData.listInvites?.map(function (invite) {
    return renderInvitationBanner(invite);
  });

  return <Fragment>{bannerElements}</Fragment>;
};

export default TeamInviteBanner;
