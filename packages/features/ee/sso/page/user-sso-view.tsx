import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { AppSkeletonLoader as SkeletonLoader, Meta } from "@calcom/ui";

import { getLayout } from "../../../settings/layouts/SettingsLayout";
import SSOConfiguration from "../components/SSOConfiguration";

const SAMLSSO = () => {
  const { t } = useLocale();
  const { data: user, isLoading } = trpc.viewer.me.useQuery();

  if (isLoading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="bg-default w-full sm:mx-0">
      <Meta
        title={t("sso_configuration")}
        description={t("sso_configuration_description")}
        borderInShellHeader={true}
      />
      <SSOConfiguration user={user} />
    </div>
  );
};

SAMLSSO.getLayout = getLayout;

export default SAMLSSO;
