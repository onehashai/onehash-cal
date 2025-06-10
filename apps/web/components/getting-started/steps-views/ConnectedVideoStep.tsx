import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { userMetadata } from "@calcom/prisma/zod-utils";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { Icon, List, showToast, Button } from "@calcom/ui";

import { AppConnectionItem } from "../components/AppConnectionItem";
import { StepConnectionLoader } from "../components/StepConnectionLoader";

interface ConnectedAppStepProps {
  nextStep: () => void;
}

const ConnectedVideoStep = (props: ConnectedAppStepProps) => {
  const { nextStep } = props;
  const { data: queryConnectedVideoApps, isPending } = trpc.viewer.integrations.useQuery({
    variant: "conferencing",
    onlyInstalled: false,
    sortByMostPopular: true,
  });
  const { data } = useMeQuery();
  const { t } = useLocale();

  const metadata = userMetadata.parse(data?.metadata);

  const hasAnyInstalledVideoApps = queryConnectedVideoApps?.items.some(
    (item) => item.userCredentialIds.length > 0
  );
  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: async (_data, _context) => {
      nextStep();
    },
    onError: () => {
      showToast(t("problem_saving_user_profile"), "error");
    },
  });

  const handleNextStep = () => {
    mutation.mutate({
      metadata: {
        currentOnboardingStep: "setup-availability",
      },
    });
  };

  const defaultConferencingApp = metadata?.defaultConferencingApp?.appSlug;
  return (
    <>
      {!isPending && (
        <List className="bg-default  border-subtle divide-subtle scroll-bar mx-1 max-h-[45vh] divide-y !overflow-y-scroll rounded-md border p-0 sm:mx-0">
          {queryConnectedVideoApps?.items &&
            queryConnectedVideoApps?.items.map((item) => {
              //CHANGE:JITSI
              // if (item.slug === "daily-video" ) return null; // we dont want to show daily here as it is installed by default

              if (item.slug === "daily-video" || item.slug === "jitsi") return null; // we dont want to show daily/jitsi here as it is installed by default
              return (
                <li key={item.name}>
                  {item.name && item.logo && (
                    <AppConnectionItem
                      type={item.type}
                      title={item.name}
                      isDefault={item.slug === defaultConferencingApp}
                      description={item.description}
                      dependencyData={item.dependencyData}
                      logo={item.logo}
                      slug={item.slug}
                      installed={item.userCredentialIds.length > 0}
                      defaultInstall={
                        !defaultConferencingApp && item.appData?.location?.linkType === "dynamic"
                      }
                    />
                  )}
                </li>
              );
            })}
        </List>
      )}

      {isPending && <StepConnectionLoader />}
      <Button
        type="button"
        data-testid="save-video-button"
        className={classNames(
          "text-inverted border-inverted bg-inverted mt-8 flex w-full flex-row justify-center rounded-md border bg-blue-500 p-2 text-center text-sm hover:bg-blue-600",
          !hasAnyInstalledVideoApps ? "cursor-not-allowed opacity-20" : ""
        )}
        disabled={!hasAnyInstalledVideoApps}
        onClick={() => handleNextStep()}
        loading={mutation.isPending}>
        {t("next_step_text")}
        <Icon name="arrow-right" className="ml-2 h-4 w-4 self-center" aria-hidden="true" />
      </Button>
    </>
  );
};

export { ConnectedVideoStep };
