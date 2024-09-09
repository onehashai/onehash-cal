"use client";

import { OrgTeamsCreationForm } from "@calcom/features/oe/organizations/components";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Meta, WizardLayout } from "@calcom/ui";
import { WizardLayoutAppDir } from "@calcom/ui";

import PageWrapper from "@components/PageWrapper";

export { getServerSideProps } from "@calcom/features/oe/organizations/pages/organization";

const AddNewTeamsPage = () => {
  const { t } = useLocale();
  return (
    <>
      <Meta title={t("create_your_teams")} description={t("create_your_teams_description")} />
      <OrgTeamsCreationForm />
    </>
  );
};

AddNewTeamsPage.getLayout = (page: React.ReactElement) => {
  return (
    <WizardLayout currentStep={4} maxSteps={4}>
      {page}
    </WizardLayout>
  );
};

AddNewTeamsPage.PageWrapper = PageWrapper;

export const WrapperAddNewTeamsPage = (page: React.ReactElement) => {
  return (
    <WizardLayoutAppDir currentStep={4} maxSteps={4}>
      {page}
    </WizardLayoutAppDir>
  );
};

export default AddNewTeamsPage;
