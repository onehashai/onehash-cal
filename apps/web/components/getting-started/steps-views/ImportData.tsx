import { CalendlyOAuthProvider } from "@onehash/calendly";
import classNames from "classnames";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import { Icon, List, showToast } from "@calcom/ui";
import { Button } from "@calcom/ui";

import useCalendlyImport from "@lib/hooks/useCalendlyImport";

const CalendlyOAuthPopUp = ({
  oauthUrl,
  onCodeReceived,
}: {
  oauthUrl: string;
  onCodeReceived: (code: string) => void;
}) => {
  const [popup, setPopup] = useState<Window | null>(null);
  const { t } = useLocale();

  const openPopup = () => {
    const width = 600;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    const popupWindow = window.open(
      oauthUrl,
      "OAuth Popup",
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
    );

    setPopup(popupWindow);

    const checkPopup = () => {
      if (!popupWindow || popupWindow.closed) return;

      try {
        if (popupWindow.location.href.includes("code=")) {
          const urlParams = new URLSearchParams(popupWindow.location.search);
          const code = urlParams.get("code");

          if (code) {
            onCodeReceived(code);
            popupWindow.close();
          }
        }
      } catch (e) {
        // Handle cross-origin issues or other errors
      }

      setTimeout(checkPopup, 500);
    };

    checkPopup();
  };

  return (
    <Button onClick={openPopup} color="secondary" StartIcon="plus">
      {t("import")}
    </Button>
  );
};

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
  const onCode = (code: string) => retrieveUserCalendlyAccessToken(code);
  const telemetry = useTelemetry();

  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (_data, _context) => {
      const redirectUrl = localStorage.getItem("onBoardingRedirect");
      localStorage.removeItem("onBoardingRedirect");
      redirectUrl ? router.push(redirectUrl) : router.push("/event-types");
    },
    onError: () => {
      showToast(t("problem_saving_user_profile"), "error");
    },
  });
  const handleFinish = () => {
    telemetry.event(telemetryEventTypes.onboardingFinished);

    mutation.mutate({
      metadata: {
        currentOnboardingStep: undefined,
      },
      completedOnboarding: true,
    });
  };

  return (
    <>
      <List className="bg-default divide-subtle border-subtle mx-1 divide-y rounded-md border p-0 sm:mx-0 dark:bg-black">
        {user && (
          <div className=" flex w-full items-center justify-between rounded border border-gray-300 px-4 py-2">
            <p>Import from Calendly</p>
            <CalendlyOAuthPopUp
              oauthUrl={calendlyOAuthProvider.getAuthorizationUrl()}
              onCodeReceived={onCode}
            />
          </div>
        )}
      </List>

      <Button
        type="button"
        data-testid="save-calendar-button"
        className={classNames(
          "mt-8 flex w-full flex-row justify-center rounded-md bg-blue-500 p-2 hover:bg-blue-600",
          importing ? "cursor-not-allowed opacity-20" : ""
        )}
        onClick={handleFinish}
        loading={mutation.isPending}
        disabled={importing}>
        {t("finish")}
        <Icon name="arrow-right" className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </>
  );
};

export { ImportData };
