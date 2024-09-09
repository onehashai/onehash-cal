"use client";

import { OrgAboutForm } from "@calcom/features/oe/organizations/components";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Meta, WizardLayout, WizardLayoutAppDir } from "@calcom/ui";

import PageWrapper from "@components/PageWrapper";

export { getServerSideProps } from "@calcom/features/oe/organizations/pages/organization";

const AboutOrganizationPage = () => {
  const { t } = useLocale();
  return (
    <>
      <Meta title={t("about_your_organization")} description={t("about_your_organization_description")} />
      <OrgAboutForm />
    </>
  );
};
export const LayoutWrapper = (page: React.ReactElement) => {
  return (
    <WizardLayout currentStep={2} maxSteps={4}>
      {page}
    </WizardLayout>
  );
};

export const WrappedAboutOrganizationPage = (page: React.ReactElement) => {
  return (
    <WizardLayoutAppDir currentStep={2} maxSteps={4}>
      {page}
    </WizardLayoutAppDir>
  );
};

AboutOrganizationPage.getLayout = LayoutWrapper;
AboutOrganizationPage.PageWrapper = PageWrapper;

export default AboutOrganizationPage;
