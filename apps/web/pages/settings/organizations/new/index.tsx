"use client";

import { CreateANewOrganizationForm } from "@calcom/features/oe/organizations/components";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { WizardLayout, Meta, WizardLayoutAppDir } from "@calcom/ui";

import { getServerSideProps } from "@lib/settings/organizations/new/getServerSideProps";
import type { inferSSRProps } from "@lib/types/inferSSRProps";

import PageWrapper from "@components/PageWrapper";

const CreateNewOrganizationPage = ({ querySlug }: inferSSRProps<typeof getServerSideProps>) => {
  const { t } = useLocale();
  return (
    <>
      <Meta title={t("set_up_your_organization")} description={t("organizations_description")} />
      <CreateANewOrganizationForm />
    </>
  );
};
const LayoutWrapper = (page: React.ReactElement) => {
  return (
    <WizardLayout currentStep={1} maxSteps={4}>
      {page}
    </WizardLayout>
  );
};

export const LayoutWrapperAppDir = (page: React.ReactElement) => {
  return (
    <WizardLayoutAppDir currentStep={1} maxSteps={4}>
      {page}
    </WizardLayoutAppDir>
  );
};

CreateNewOrganizationPage.getLayout = LayoutWrapper;
CreateNewOrganizationPage.PageWrapper = PageWrapper;

export default CreateNewOrganizationPage;

export { getServerSideProps };
