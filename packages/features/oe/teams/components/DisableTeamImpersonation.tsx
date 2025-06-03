import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { showToast, SettingsToggle } from "@calcom/ui";

interface ImpersonationControlProps {
  teamId: number;
  memberId: number;
  disabled: boolean;
}

const DisableTeamImpersonation = (props: ImpersonationControlProps) => {
  const { teamId: organizationId, memberId: userId, disabled: isDisabled } = props;
  const { t } = useLocale();
  const trpcUtils = trpc.useUtils();

  const membershipQuery = trpc.viewer.teams.getMembershipbyUser.useQuery({
    teamId: organizationId,
    memberId: userId,
  });

  const membershipUpdateMutation = trpc.viewer.teams.updateMembership.useMutation({
    onSuccess: async () => {
      showToast(t("your_user_profile_updated_successfully"), "success");
      await trpcUtils.viewer.teams.getMembershipbyUser.invalidate();
    },
  });

  const [impersonationEnabled, setImpersonationEnabled] = useState<boolean>(
    !membershipQuery.data?.disableImpersonation ?? true
  );

  if (membershipQuery.isPending) {
    return <></>;
  }

  const handleToggleChange = (enabledState: boolean) => {
    setImpersonationEnabled(enabledState);
    membershipUpdateMutation.mutate({
      teamId: organizationId,
      memberId: userId,
      disableImpersonation: !enabledState,
    });
  };

  return (
    <>
      <SettingsToggle
        toggleSwitchAtTheEnd={true}
        title={t("user_impersonation_heading")}
        disabled={isDisabled || membershipUpdateMutation?.isPending}
        description={t("team_impersonation_description")}
        checked={impersonationEnabled}
        onCheckedChange={handleToggleChange}
      />
    </>
  );
};

export default DisableTeamImpersonation;
