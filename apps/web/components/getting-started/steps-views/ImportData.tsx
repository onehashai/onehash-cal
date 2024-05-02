import { CalendlyOAuthProvider } from "@onehash/calendly";
import classNames from "classnames";
import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/router";
import OauthPopup from "react-oauth-popup";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import { List, showToast } from "@calcom/ui";
import { Button } from "@calcom/ui";

import useCalendlyImport from "@lib/hooks/useCalendlyImport";

const ImportData = () => {
  const [user] = trpc.viewer.me.useSuspenseQuery();
  const router = useRouter();
  const { t } = useLocale();
  const { importFromCalendly, importing } = useCalendlyImport(user.id);

  /**
   * Retrieves and stores the user's access token and refresh token from Calendly
   * @param code  Authorization Code is a temporary code that the client exchanges for an access token.
   */
  const retrieveUserCalendlyAccessToken = async (code: string) => {
    fetch("/api/import/calendly/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        userId: user.id,
      }),
    }).then(() => importFromCalendly().then(handleFinish));
  };

  const calendlyOAuthProvider = new CalendlyOAuthProvider({
    clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
    oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });
  const onCode = (code: string, _params: URLSearchParams) => retrieveUserCalendlyAccessToken(code);
  const onClose = () => console.log("closed!");
  const telemetry = useTelemetry();

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (_data, _context) => {
      const redirectUrl = localStorage.getItem("onBoardingRedirect");
      localStorage.removeItem("onBoardingRedirect");
      redirectUrl ? router.push(redirectUrl) : router.push("/");
    },
    onError: () => {
      showToast(t("problem_saving_user_profile"), "error");
    },
  });
  const handleFinish = () => {
    telemetry.event(telemetryEventTypes.onboardingFinished);

    mutation.mutate({
      completedOnboarding: true,
    });
  };

  return (
    <>
      <List className="bg-default divide-subtle border-subtle mx-1 divide-y rounded-md border p-0 dark:bg-black sm:mx-0">
        {user && (
          <div className=" flex w-full items-center justify-between rounded border border-gray-300 px-4 py-2">
            <p>Import from Calendly</p>
            <OauthPopup
              url={calendlyOAuthProvider.getAuthorizationUrl()}
              onCode={onCode}
              onClose={onClose}
              height={400}
              width={600}
              title="">
              <Button
                color="secondary"
                className=" flex flex-row justify-center"
                loading={importing}
                StartIcon={Plus}>
                {t("import")}
              </Button>
            </OauthPopup>
          </div>
        )}
      </List>

      <button
        type="button"
        data-testid="save-calendar-button"
        className={classNames(
          "mt-8 flex w-full flex-row justify-center rounded-md bg-blue-500 p-2 hover:bg-blue-600",
          importing ? "cursor-not-allowed opacity-20" : ""
        )}
        onClick={handleFinish}
        disabled={importing}>
        {t("finish")}
        <ArrowRight className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </button>
    </>
  );
};

export { ImportData };
