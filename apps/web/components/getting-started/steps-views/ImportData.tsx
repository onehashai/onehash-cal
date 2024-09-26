import classNames from "classnames";
import { useRouter } from "next/navigation";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { telemetryEventTypes, useTelemetry } from "@calcom/lib/telemetry";
import { trpc } from "@calcom/trpc/react";
import { CheckboxField, Icon, showToast } from "@calcom/ui";
import { Button } from "@calcom/ui";

import useCalendlyImport from "@lib/hooks/useCalendlyImport";

const ImportData = () => {
  const [user] = trpc.viewer.me.useSuspenseQuery();
  const { handleChangeNotifyUsers, sendCampaignEmails } = useCalendlyImport(user.id);
  const router = useRouter();
  const { t } = useLocale();

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

  const handleOnClickImport = () => {
    const queryParams = {
      client_id: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
      response_type: "code",
    };
    window.location.href = `${process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL}/authorize?${new URLSearchParams(
      queryParams
    )}`;
  };

  return (
    <>
      {user && (
        <>
          <div className=" flex w-full items-center justify-between rounded border border-gray-300 px-4 py-2">
            <p>Import from Calendly</p>
            <Button onClick={handleOnClickImport} color="secondary" StartIcon="plus">
              {t("import")}
            </Button>
          </div>
          <div className="mt-3 px-4">
            <CheckboxField
              checked={sendCampaignEmails}
              description={t("notify_past_bookers")}
              onChange={(e) => {
                handleChangeNotifyUsers(e.target.checked);
              }}
            />
          </div>
        </>
      )}

      <Button
        type="button"
        data-testid="save-calendar-button"
        className={classNames(
          "mt-8 flex w-full flex-row justify-center rounded-md bg-blue-500 p-2 hover:bg-blue-600"
        )}
        onClick={handleFinish}
        loading={mutation.isPending}>
        {t("finish")}
        <Icon name="arrow-right" className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </>
  );
};

export { ImportData };
