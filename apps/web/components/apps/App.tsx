import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HeadSeo } from "@calcom/ui";

import type { AppPageProps } from "./AppPage";
import { AppPage } from "./AppPage";

const ShellHeading = () => {
  const { t } = useLocale();
  return <span className="block py-2">{t("app_store")}</span>;
};

export default function WrappedApp(props: AppPageProps) {
  return (
    <Shell smallHeading isPublic hideHeadingOnMobile heading={<ShellHeading />} backPath="/apps" withoutSeo>
      <HeadSeo
        title={props.name}
        description={props.description}
        app={{ slug: props.logo, name: props.name, description: props.description }}
      />
      {/* {props.licenseRequired ? (
        <>
          <AppPage {...props} />
        </>
      ) : (
        <AppPage {...props} />
      )} */}
      <AppPage {...props} />
    </Shell>
  );
}
