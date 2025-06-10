"use client";

import { CreateANewOrganizationForm } from "@calcom/features/oe/organizations/components";
import { WizardLayout } from "@calcom/ui";

export const LayoutWrapper = (page: React.ReactElement) => {
  return (
    <WizardLayout currentStep={1} maxSteps={5}>
      {page}
    </WizardLayout>
  );
};

export default CreateANewOrganizationForm;
