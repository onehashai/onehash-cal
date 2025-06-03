import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { showToast, SettingsToggle } from "@calcom/ui";

interface TeamPrivacyConfiguration {
  teamId: number;
  isPrivate: boolean;
  disabled: boolean;
  isOrg: boolean;
}

const createSuccessMessage = (translator: any, organizationMode: boolean) => {
  const messageKey = organizationMode ? "your_org_updated_successfully" : "your_team_updated_successfully";
  return translator(messageKey);
};

const generateToggleTitle = (translator: any, organizationMode: boolean) => {
  const titleKey = organizationMode ? "make_org_private" : "make_team_private";
  return translator(titleKey);
};

const generateToggleDescription = (translator: any, organizationMode: boolean) => {
  const descriptionKey = organizationMode ? "make_org_private_description" : "make_team_private_description";
  return translator(descriptionKey);
};

const useTeamUpdateMutation = (organizationMode: boolean) => {
  const { t } = useLocale();
  const queryUtils = trpc.useUtils();

  return trpc.viewer.teams.update.useMutation({
    onError: (error) => {
      showToast(error.message, "error");
    },
    async onSuccess() {
      await queryUtils.viewer.teams.get.invalidate();
      const successMessage = createSuccessMessage(t, organizationMode);
      showToast(successMessage, "success");
    },
  });
};

const MakeTeamPrivateSwitch = (config: TeamPrivacyConfiguration) => {
  const { t } = useLocale();
  const [privacyState, setPrivacyState] = useState(config.isPrivate);
  const updateTeamMutation = useTeamUpdateMutation(config.isOrg);

  const handlePrivacyToggle = (newPrivacyValue: boolean) => {
    setPrivacyState(newPrivacyValue);
    updateTeamMutation.mutate({
      id: config.teamId,
      isPrivate: newPrivacyValue,
    });
  };

  const isToggleDisabled = config.disabled || updateTeamMutation?.isPending;
  const toggleTitle = generateToggleTitle(t, config.isOrg);
  const toggleDescription = generateToggleDescription(t, config.isOrg);

  return (
    <>
      <SettingsToggle
        toggleSwitchAtTheEnd={true}
        title={toggleTitle}
        disabled={isToggleDisabled}
        description={toggleDescription}
        checked={privacyState}
        onCheckedChange={handlePrivacyToggle}
        switchContainerClassName="my-6"
        data-testid="make-team-private-check"
      />
    </>
  );
};

export default MakeTeamPrivateSwitch;
