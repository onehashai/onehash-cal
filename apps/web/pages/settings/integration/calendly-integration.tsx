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

const ImportFromCalendlyButton = ({
  authorizationUrl,
  onCode,
  onClose,
}: {
  authorizationUrl: string;
  onCode: (code: string) => void;
  onClose: () => void;
}) => {
  const { t } = useLocale();

  return (
    <OauthPopup url={authorizationUrl} onCode={onCode} onClose={onClose} height={400} width={600} title="">
      <Button color="secondary" StartIcon={Plus}>
        {t("integrate")}
      </Button>
    </OauthPopup>
  );
};

const ConferencingLayout = () => {
  const { t } = useLocale();

  const [userId, setUserId] = useState<number>();
  const [isAuthorized, setIsAuthorized] = useState<boolean>();
  const [loading, setLoading] = useState<boolean>(true);

  const session = useSession();
  const checkIfAuthorized = async (id: number) => {
    try {
      setLoading(true);
      if (!id) return;
      const res = await fetch(`/api/integrations/calendly?userId=${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const data = await res.json();
        console.log("error", data);
        return;
      }
      const data = await res.json();
      setIsAuthorized(data.authorized);
      console.log("authorized:", data.authorized);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!session || !session.data) return;
    session.data.user.id && setUserId(session.data.user.id);
    checkIfAuthorized(session.data.user.id);
  }, [session]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onCode = async (code: any) => {
    const res = await fetch("/api/integrations/calendly", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        userId,
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
    oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });

  return (
    <>
      {loading ? (
        <SkeletonLoader title="Calendly" description={t("import_from_calendly_description")} />
      ) : isAuthorized ? (
        //TODO: INTERFACE TO IMPORT EVENTS
        <div>Start importing</div>
      ) : (
        <div className="bg-default w-full sm:mx-0 xl:mt-0">
          <Meta
            title="Calendly"
            description={t("import_from_calendly_description")}
            CTA={
              <ImportFromCalendlyButton
                onClose={onClose}
                onCode={onCode}
                authorizationUrl={calendlyOAuthProvider.getAuthorizationUrl()}
              />
            }
            borderInShellHeader={true}
          />
        </div>
      )}
    </>
  );
};

ConferencingLayout.getLayout = getLayout;
ConferencingLayout.PageWrapper = PageWrapper;

export default ConferencingLayout;
