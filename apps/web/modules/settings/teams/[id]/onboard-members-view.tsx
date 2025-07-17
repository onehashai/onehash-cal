"use client";

import { CreateANewTeamForm } from "@calcom/features/ee/teams/components/CreateANewTeamForm";
import { WizardLayout } from "@calcom/ui";

export const GetLayout = (page: React.ReactElement) => (
  <WizardLayout currentStep={2} maxSteps={3}>
    {page}
  </WizardLayout>
);

export default CreateANewTeamForm;
