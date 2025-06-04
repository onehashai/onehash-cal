import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { APP_NAME, WEBAPP_URL } from "@calcom/lib/constants";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Alert, Button, ButtonGroup, EmptyScreen, Icon, Label, showToast } from "@calcom/ui";

import { UpgradeTip } from "../../../tips";
import SkeletonLoaderTeamList from "./SkeletonloaderTeamList";
import TeamList from "./TeamList";

export function TeamsListing() {
  const queryParams = useCompatSearchParams();
  const authToken = queryParams?.get("token");
  const { t } = useLocale();
  const trpcUtilities = trpc.useUtils();
  const navigationRouter = useRouter();

  const [hasValidatedInviteToken, setHasValidatedInviteToken] = useState(false);

  const {
    data: teamsData,
    isPending: isLoadingTeams,
    error: fetchError,
  } = trpc.viewer.teams.list.useQuery(
    {
      includeOrgs: true,
    },
    {
      enabled: hasValidatedInviteToken,
    }
  );

  const { data: currentUser } = trpc.viewer.me.useQuery();

  const { mutate: processInviteToken } = trpc.viewer.teams.inviteMemberByToken.useMutation({
    onSuccess: (teamIdentifier) => {
      trpcUtilities.viewer.teams.list.invalidate();
      showToast(t("team_invite_received", { teamName: teamIdentifier }), "success");
    },
    onError: (errorResponse) => {
      showToast(errorResponse.message, "error");
    },
    onSettled: () => {
      setHasValidatedInviteToken(true);
    },
  });

  const acceptedTeamsList = useMemo(
    () => teamsData?.filter((member) => member.accepted && !member.isOrganization) || [],
    [teamsData]
  );

  const pendingTeamInvitations = useMemo(
    () => teamsData?.filter((member) => !member.accepted && !member.isOrganization) || [],
    [teamsData]
  );

  const pendingOrganizationInvitations = (
    teamsData?.filter((member) => !member.accepted && member.isOrganization) || []
  ).filter((organizationInvite) => {
    const hasRelatedSubTeamInvite = pendingTeamInvitations.find(
      (teamInvitation) => teamInvitation.parentId === organizationInvite.id
    );
    return !hasRelatedSubTeamInvite;
  });

  const shouldDisableCreateButton = !!(currentUser?.organizationId && !currentUser?.organization?.isOrgAdmin);

  const platformFeatures = [
    {
      icon: <Icon name="users" className="h-5 w-5 text-red-500" />,
      title: t("collective_scheduling"),
      description: t("make_it_easy_to_book"),
    },
    {
      icon: <Icon name="refresh-ccw" className="h-5 w-5 text-blue-500" />,
      title: t("round_robin"),
      description: t("find_the_best_person"),
    },
    {
      icon: <Icon name="user-plus" className="h-5 w-5 text-green-500" />,
      title: t("fixed_round_robin"),
      description: t("add_one_fixed_attendee"),
    },
    {
      icon: <Icon name="mail" className="h-5 w-5 text-orange-500" />,
      title: t("sms_attendee_action"),
      description: t("send_reminder_sms"),
    },
    {
      icon: <Icon name="video" className="h-5 w-5 text-purple-500" />,
      title: `Cal Video ${t("recordings_title")}`,
      description: t("upgrade_to_access_recordings_description"),
    },
    {
      icon: <Icon name="eye-off" className="h-5 w-5 text-indigo-500" />,
      title: t("disable_cal_branding", { appName: APP_NAME }),
      description: t("disable_cal_branding_description", { appName: APP_NAME }),
    },
  ];

  useEffect(() => {
    if (!navigationRouter) return;

    authToken ? processInviteToken({ token: authToken }) : setHasValidatedInviteToken(true);
  }, [navigationRouter, processInviteToken, setHasValidatedInviteToken, authToken]);

  if (isLoadingTeams || !hasValidatedInviteToken) {
    return <SkeletonLoaderTeamList />;
  }

  const organizationInviteSection = pendingOrganizationInvitations.length > 0 && (
    <div className="bg-subtle mb-6 rounded-md p-5">
      <Label className="text-emphasis pb-2  font-semibold">{t("pending_organization_invites")}</Label>
      <TeamList teams={pendingOrganizationInvitations} pending />
    </div>
  );

  const teamInviteSection = pendingTeamInvitations.length > 0 && (
    <div className="bg-subtle mb-6 rounded-md p-5">
      <Label className="text-emphasis pb-2  font-semibold">{t("pending_invites")}</Label>
      <TeamList teams={pendingTeamInvitations} pending />
    </div>
  );

  const createTeamButtonGroup =
    !currentUser?.organizationId || currentUser?.organization.isOrgAdmin ? (
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
    ) : (
      <p>{t("org_admins_can_create_new_teams")}</p>
    );

  const emptyStateScreen = (
    <EmptyScreen
      Icon="users"
      headline={t("create_team_to_get_started")}
      description={t("create_first_team_and_invite_others")}
      buttonRaw={
        <Button
          color="secondary"
          data-testid="create-team-btn"
          disabled={!!shouldDisableCreateButton}
          tooltip={shouldDisableCreateButton ? t("org_admins_can_create_new_teams") : t("create_new_team")}
          onClick={() =>
            navigationRouter.push(`${WEBAPP_URL}/settings/teams/new?returnTo=${WEBAPP_URL}/teams`)
          }>
          {t(`create_new_team`)}
        </Button>
      }
    />
  );

  const teamListContent =
    acceptedTeamsList.length > 0 ? <TeamList teams={acceptedTeamsList} /> : emptyStateScreen;

  return (
    <>
      {!!fetchError && <Alert severity="error" title={fetchError.message} />}

      {organizationInviteSection}
      {teamInviteSection}

      <UpgradeTip
        plan="team"
        title={t("calcom_is_better_with_team", { appName: APP_NAME })}
        description="add_your_team_members"
        features={platformFeatures}
        background="/tips/teams"
        buttons={createTeamButtonGroup}>
        {teamListContent}
      </UpgradeTip>
    </>
  );
}
