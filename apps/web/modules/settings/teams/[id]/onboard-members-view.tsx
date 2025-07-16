"use client";

import { CreateANewTeamForm as AddNewTeamMembers } from "@calcom/features/oe/teams/components/CreateANewTeamForm";
import { WizardLayout } from "@calcom/ui";

export const GetLayout = (page: React.ReactElement) => (
  <WizardLayout currentStep={2} maxSteps={3}>
    {page}
  </WizardLayout>
);

export default AddNewTeamMembers;
