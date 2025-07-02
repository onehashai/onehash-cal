"use client";

import { useRouter } from "next/navigation";

import TeamMemberAddition from "@calcom/features/ee/teams/components/TeamMemberAddition";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { WizardLayout } from "@calcom/ui";

export const LayoutWrapper = (page: React.ReactElement) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const router = useRouter();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const query = useCompatSearchParams();

  return (
    <WizardLayout
      currentStep={4}
      maxSteps={5}
      isOptionalCallback={() => {
        router.push(`/settings/organizations/${query.get("id")}/add-teams`);
      }}>
      {page}
    </WizardLayout>
  );
};

const OrgTeamMemberAddition = () => <TeamMemberAddition isOrg={true} />;
export default OrgTeamMemberAddition;
