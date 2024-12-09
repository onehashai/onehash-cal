import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { IS_PRODUCTION, COMPANY_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Meta, Button } from "@calcom/ui";

import PageWrapper from "@components/PageWrapper";

const Page = () => {
  const { t } = useLocale();
  const userHref = IS_PRODUCTION
    ? "https://sso.onehash.ai/realms/OneHash/account/#/security/signingin"
    : "http://localhost:8080/realms/OneHash/account/#/security/signingin";
  return (
    <>
      <Meta
        title={t("account_managed_by_identity_provider", {
          provider: COMPANY_NAME,
        })}
        description={t("account_managed_by_identity_provider_description", {
          provider: COMPANY_NAME,
        })}
        borderInShellHeader={true}
        CTA={
          <Button href={userHref} target="_blank" color="secondary" EndIcon="external-link">
            {t("visit")}
          </Button>
        }
      />
    </>
  );
};

Page.getLayout = getLayout;
Page.PageWrapper = PageWrapper;

export default Page;
