// eslint-disable-next-line no-restricted-imports
import { useEffect, useState } from "react";

import { useTeamInvites } from "@calcom/lib/hooks/useHasPaidPlan";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Button, showToast, TopBanner, Icon } from "@calcom/ui";

// export type TeamInviteBannerProps = { data: boolean };

function TeamInviteBanner() {
  const { t } = useLocale();

  const [showInviteeBadge, setShowInviteeBadge] = useState(false);
  const [pendingTeamIds, setPendingTeamIds] = useState<number[]>([]);
  const [hiddenInvites, setHiddenInvites] = useState<number[]>([]);

  const { isPending, listInvites } = useTeamInvites();
  const utils = trpc.useUtils();

  const acceptOrLeaveMutation = trpc.viewer.teams.acceptOrLeave.useMutation({
    onSuccess: () => {
      showToast(t("success"), "success");
      utils.viewer.teams.get.invalidate();
      utils.viewer.teams.list.invalidate();
      utils.viewer.teams.hasTeamPlan.invalidate();
      utils.viewer.teams.listInvites.invalidate();
    },
  });

  useEffect(() => {
    if (isPending || !listInvites?.length) return;

    const disabledBadges = localStorage.getItem("disabledTeamNotifications");
    const parsedDisabledBadges = disabledBadges ? JSON.parse(disabledBadges) : [];

    const pendingIds = listInvites
      .map((invite) => invite.teamId)
      .filter((id) => !parsedDisabledBadges.includes(id));

    setHiddenInvites(parsedDisabledBadges);
    setPendingTeamIds(pendingIds);
    setShowInviteeBadge(pendingIds.length > 0);
  }, [listInvites, isPending]);

  const handleAcceptOrLeave = (accept: boolean, teamId: number) => {
    acceptOrLeaveMutation.mutate({ teamId, accept });
  };

  const handleHideInvite = (teamId: number) => {
    const updatedHiddenInvites = [...hiddenInvites, teamId];
    setHiddenInvites(updatedHiddenInvites);
    setPendingTeamIds(listInvites?.map((invite) => invite.teamId).filter((id) => id !== teamId) ?? []);
    localStorage.setItem("disabledTeamNotifications", JSON.stringify(updatedHiddenInvites));
  };

  if (!showInviteeBadge) return null;

  return (
    <>
      {listInvites?.map((invite) => {
        if (!pendingTeamIds.includes(invite.teamId)) return null;

        return (
          <TopBanner
            key={invite.teamId}
            text={t("pending_invites_team", { teamName: invite.team.name })}
            variant="warning"
            actions={
              <div className="flex gap-2">
                <Button
                  color="minimal"
                  className="border"
                  onClick={() => handleAcceptOrLeave(true, invite.teamId)}>
                  Accept
                </Button>
                <Button
                  color="minimal"
                  className="border"
                  onClick={() => handleAcceptOrLeave(false, invite.teamId)}>
                  Decline
                </Button>
                <Button color="minimal" onClick={() => handleHideInvite(invite.teamId)}>
                  <Icon name="x" />
                </Button>
              </div>
            }
          />
        );
      })}
    </>
  );
}

export default TeamInviteBanner;
