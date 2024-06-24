import { CalendlyOAuthProvider } from "@onehash/calendly";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import OauthPopup from "react-oauth-popup";

import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, Meta, SkeletonContainer } from "@calcom/ui";

import useCalendlyImport from "@lib/hooks/useCalendlyImport";

import PageWrapper from "@components/PageWrapper";

const SkeletonLoader = ({ title, description }: { title: string; description: string }) => {
  return (
    <SkeletonContainer>
      <Meta title={title} description={description} borderInShellHeader={true} />
    </SkeletonContainer>
  );
};

//Component responsible for importing data from Calendly if user has already authorized Calendly
const ImportFromCalendlyButton = ({
  importFromCalendly,
  importing,
}: {
  importFromCalendly: () => Promise<void>;
  importing: boolean | undefined;
}) => {
  const { t } = useLocale();

  return (
    <Button color="secondary" StartIcon="plus" onClick={importFromCalendly} loading={importing}>
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
  onCode: (code: string, params: URLSearchParams) => void;
  onClose: () => void;
}) => {
  const { t } = useLocale();

  return (
    <OauthPopup url={authorizationUrl} onCode={onCode} onClose={onClose} height={400} width={600} title="">
      <Button color="secondary" StartIcon="plus">
        {t("import")}
      </Button>
    </OauthPopup>
  );
};

//Main view for Calendly import
const ImportLayout = () => {
  const [userId, setUserId] = useState<number>();

  const session = useSession();

  //checks if the user had already authorized Calendly on first load
  useEffect(() => {
    if (!session || !session.data) return;
    session.data.user.id && setUserId(session.data.user.id);
  }, [session]);

  return <> {userId ? <CalendlyImportComponent userId={userId} /> : <></>}</>;
};

const CalendlyImportComponent = ({ userId }: { userId: number }) => {
  const { importFromCalendly, importing } = useCalendlyImport(userId);
  const [loading, setLoading] = useState<boolean>(true);
  const [didAuthorize, setDidAuthorize] = useState<boolean>(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const { t } = useLocale();

  useEffect(() => {
    checkIfAuthorized(userId);
  }, [userId]);
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
        console.error("error", data);
        return;
      }
      const data = await res.json();
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
  const retrieveUserCalendlyAccessToken = (code: string) => {
    fetch("/api/import/calendly/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        userId,
      }),
    }).then(
      (res) => {
        if (res.ok) {
          setIsAuthorized(true);
          setDidAuthorize(true);
        }
      },
      (err) => {
        console.error("Error retrieving tokens", err);
      }
    );
  };

  //handles the authorization code returned from Calendly
  const onCode = (code: string, _params: URLSearchParams) => retrieveUserCalendlyAccessToken(code);
  const onClose = () => console.log("closed!");
  const calendlyOAuthProvider = new CalendlyOAuthProvider({
    clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
    oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });
  useEffect(() => {
    if (didAuthorize) {
      importFromCalendly();
    }
  }, [didAuthorize]);

  return (
    <>
      {loading ? (
        <SkeletonLoader title="Calendly" description={t("import_data_instructions")} />
      ) : (
        <div className="bg-default w-full sm:mx-0 xl:mt-0">
          <Meta
            title="Calendly"
            description={t("import_data_instructions")}
            CTA={
              isAuthorized ? (
                <ImportFromCalendlyButton importFromCalendly={importFromCalendly} importing={importing} />
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

ImportLayout.getLayout = getLayout;
ImportLayout.PageWrapper = PageWrapper;

export default ImportLayout;
