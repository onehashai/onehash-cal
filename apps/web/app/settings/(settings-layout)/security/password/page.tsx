import { _generateMetadata } from "app/_utils";
import { getTranslate } from "app/_utils";

import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { COMPANY_NAME, IS_PRODUCTION } from "@calcom/lib/constants";
import { Button } from "@calcom/ui";

export const generateMetadata = async () =>
  await _generateMetadata(
    (t) => t("account_managed_by_identity_provider"),
    (t) => t("account_managed_by_identity_provider_description")
  );

const Page = async () => {
  const t = await getTranslate();
  const userHref = IS_PRODUCTION
    ? "https://sso.onehash.ai/realms/OneHash/account/#/security/signingin"
    : "http://localhost:8080/realms/OneHash/account/#/security/signingin";

  return (
    <SettingsHeader
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
      }>
      <></>
    </SettingsHeader>
  );
};

export default Page;
