import CalendlyOAuthProvider from "@onehash/calendly/utils/calendly-oauth-provider";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import OauthPopup from "react-oauth-popup";

import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, Meta, SkeletonContainer, SkeletonText } from "@calcom/ui";

import PageWrapper from "@components/PageWrapper";

const SkeletonLoader = ({ title, description }: { title: string; description: string }) => {
  return (
    <SkeletonContainer>
      <Meta title={title} description={description} borderInShellHeader={true} />
      <div className="divide-subtle border-subtle space-y-6 rounded-b-lg border border-t-0 px-6 py-4">
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
      </div>
    </SkeletonContainer>
  );
};

const ImportFromCalendlyButton = () => {
  const { t } = useLocale();
  // const [externalPopup, setExternalPopup] = useState<Window | null>(null);

  // const handleOnClick = () => {
  //   const externalURL = getAuthorizationUrl();
  //   const popupOptions = "width=600,height=400,resizable=yes";

  //   // Open the pop-up window
  //   const popupWindow = window.open(externalURL, "popupWindow", popupOptions);

  //   // Optional: Focus on the pop-up window
  //   if (popupWindow) {
  //     popupWindow.focus();
  //   }
  //   setExternalPopup(popupWindow);
  // };

  // useEffect(() => {
  //   if (!externalPopup) {
  //     return;
  //   }

  //   const timer = setInterval(() => {
  //     if (!externalPopup) {
  //       timer && clearInterval(timer);
  //       return;
  //     }
  //     const currentUrl = externalPopup.location.href;
  //     if (!currentUrl) {
  //       return;
  //     }
  //     const searchParams = new URL(currentUrl).searchParams;
  //     console.log("searchParams", searchParams);
  //     const authenticated = searchParams.get("authenticated");
  //     if (authenticated) {
  //       externalPopup.close();
  //       setExternalPopup(null);
  //       timer && clearInterval(timer);
  //     }
  //   }, 500);
  // }, [externalPopup]);
  const [userEmail, setUserEmail] = useState<string>();
  const session = useSession();
  useEffect(() => {
    if (!session) return;
    session.data && session.data.user.email && setUserEmail(session.data.user.email);
  }, [session]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCode = async (code: any) => {
    console.log("wooooo a code", code);
    const res = await fetch("/api/integrations/calendly", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        userEmail,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      console.log("error", data);
      return;
    }
    const data = await res.json();
    console.log("data", data);
  };
  const onClose = () => console.log("closed!");
  const calendlyOAuthProvider = new CalendlyOAuthProvider({
    clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    clientSecret: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET ?? "",
    redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
    authorizeUrl: process.env.NEXT_PUBLIC_CALENDLY_AUTHORIZE_URL ?? "",
    tokenUrl: process.env.NEXT_PUBLIC_CALENDLY_TOKEN_URL ?? "",
  });

  return (
    <OauthPopup
      url={calendlyOAuthProvider.getAuthorizationUrl()}
      onCode={onCode}
      onClose={onClose}
      height={400}
      width={600}
      title="">
      <Button color="secondary" StartIcon={Plus}>
        {t("integrate")}
      </Button>
    </OauthPopup>
  );
};

const ConferencingLayout = () => {
  const { t } = useLocale();

  useEffect(() => {
    //get user
  }, []);

  return (
    <>
      <div className="bg-default w-full sm:mx-0 xl:mt-0">
        <Meta
          title="Calendly"
          description={t("import_from_calendly_description")}
          CTA={<ImportFromCalendlyButton />}
          borderInShellHeader={true}
        />

        {/* <QueryCell
          query={query}
          customLoader={
            <SkeletonLoader title={t("conferencing")} description={t("conferencing_description")} />
          }
          success={({ data }) => {
            console.log(data);
            if (!data.items.length) {
              return (
                <EmptyScreen
                  Icon={Calendar}
                  headline={t("no_category_apps", {
                    category: t("conferencing").toLowerCase(),
                  })}
                  description={t("no_category_apps_description_conferencing")}
                  buttonRaw={
                    <Button
                      color="secondary"
                      data-testid="connect-conferencing-apps"
                      href="/apps/categories/conferencing">
                      {t("connect_conference_apps")}
                    </Button>
                  }
                />
              );
            }
            return (
              <AppList
                listClassName="rounded-lg rounded-t-none border-t-0"
                handleDisconnect={handleDisconnect}
                data={data}
                variant="conferencing"
              />
            );
          }}
        /> */}
      </div>
    </>
  );
};

ConferencingLayout.getLayout = getLayout;
ConferencingLayout.PageWrapper = PageWrapper;

export default ConferencingLayout;
