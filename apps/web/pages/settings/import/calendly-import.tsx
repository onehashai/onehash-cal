import CalendlyOAuthProvider from "@onehash/calendly/utils/calendly-oauth-provider";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import OauthPopup from "react-oauth-popup";

import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, Meta, SkeletonContainer, SkeletonText, showToast } from "@calcom/ui";

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

//Component responsible for importing data from Calendly if user has already authorized Calendly
const ImportFromCalendlyButton = ({ importFromCalendly }: { importFromCalendly: () => Promise<void> }) => {
  const { t } = useLocale();
  const [loading, setLoading] = useState<boolean>(false);
  const _importFromCalendly = async () => {
    try {
      setLoading(true);
      await importFromCalendly();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button color="secondary" StartIcon={Plus} onClick={_importFromCalendly} loading={loading}>
      {t("import")}
    </Button>
  );
};

//Component responsible for authorizing Calendly on first time import
const AuthorizeCalendlyButton = ({
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
        {t("import")}
      </Button>
    </OauthPopup>
  );
};

//Main view for Calendly import
const ConferencingLayout = () => {
  const { t } = useLocale();

  const [userId, setUserId] = useState<number>();
  const [isAuthorized, setIsAuthorized] = useState<boolean>();
  const [loading, setLoading] = useState<boolean>(true);

  const session = useSession();

  /**
   * Checks if the user has already authorized Calendly and sets the state accordingly
   * @param userId The user id of the current user
   */
  const checkIfAuthorized = async (userId: number) => {
    try {
      setLoading(true);
      if (!userId) return;
      const res = await fetch(`/api/import/calendly/auth?userId=${userId}`, {
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
      console.log("data", data);
      setIsAuthorized(data.authorized);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retrieves and stores the user's access token and refresh token from Calendly
   * @param code  Authorization Code is a temporary code that the client exchanges for an access token.
   */
  const retrieveUserCalendlyAccessToken = async (code: string) => {
    try {
      const res = await fetch("/api/import/calendly/auth", {
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
      setIsAuthorized(true);
      // await importFromCalendly();
    } catch (e) {
      console.error("Error retrieving tokens", e);
    }
  };

  //handles the authorization code returned from Calendly
  const onCode = (code: string) => retrieveUserCalendlyAccessToken(code);
  const onClose = () => console.log("closed!");
  const calendlyOAuthProvider = new CalendlyOAuthProvider({
    clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    clientSecret: process.env.CALENDLY_CLIENT_SECRET ?? "",
    redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
    oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });

  //responsible for the api call to import data from Calendly
  const importFromCalendly = async () => {
    try {
      if (!isAuthorized) return;
      const uri = `/api/import/calendly?userId=${userId}`;
      const res = await fetch(uri, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      });
      const data = await res.json();
      if (!res.ok) {
        console.log("error", data);
        return;
      }
      console.log("data", data);
      showToast("Data imported successfully", "success");
    } catch (e) {
      console.error("Error importing from Calendly", e);
    }
  };

  //checks if the user had already authorized Calendly on first load
  useEffect(() => {
    if (!session || !session.data) return;
    session.data.user.id && setUserId(session.data.user.id);
    checkIfAuthorized(session.data.user.id);
  }, [session]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any

  return (
    <>
      {loading ? (
        <SkeletonLoader title="Calendly" description={t("import_from_calendly_description")} />
      ) : (
        <div className="bg-default w-full sm:mx-0 xl:mt-0">
          <Meta
            title="Calendly"
            description={t("import_from_calendly_description")}
            CTA={
              isAuthorized ? (
                <ImportFromCalendlyButton importFromCalendly={importFromCalendly} />
              ) : (
                <AuthorizeCalendlyButton
                  onClose={onClose}
                  onCode={onCode}
                  authorizationUrl={calendlyOAuthProvider.getAuthorizationUrl()}
                />
              )
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
