"use client";

import TeamMemberAddition from "@calcom/features/oe/teams/components/TeamMemberAddition";
import { WizardLayout } from "@calcom/ui";

export const GetLayout = (page: React.ReactElement) => (
  <WizardLayout currentStep={2} maxSteps={3}>
    {page}
  </WizardLayout>
);

export default TeamMemberAddition;
