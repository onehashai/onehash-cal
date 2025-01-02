import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { IframeHTMLAttributes } from "react";
import React, { useEffect, useState } from "react";

import useAddAppMutation from "@calcom/app-store/_utils/useAddAppMutation";
import { AppDependencyComponent, InstallAppButton } from "@calcom/app-store/components";
import { doesAppSupportTeamInstall, isConferencing } from "@calcom/app-store/utils";
import DisconnectIntegration from "@calcom/features/apps/components/DisconnectIntegration";
import { AppOnboardingSteps } from "@calcom/lib/apps/appOnboardingSteps";
import { getAppOnboardingUrl } from "@calcom/lib/apps/getAppOnboardingUrl";
import classNames from "@calcom/lib/classNames";
import {
  APP_NAME,
  COMPANY_NAME,
  ONEHASH_CHAT_INTEGRATION_PAGE,
  SUPPORT_MAIL_ADDRESS,
  WEBAPP_URL,
} from "@calcom/lib/constants";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import type { App as AppType } from "@calcom/types/App";
import {
  Badge,
  Button,
  Icon,
  SkeletonButton,
  SkeletonText,
  showToast,
  Dropdown,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@calcom/ui";

import { InstallAppButtonChild } from "./InstallAppButtonChild";

export type AppPageProps = {
  name: string;
  description: AppType["description"];
  type: AppType["type"];
  isGlobal?: AppType["isGlobal"];
  logo: string;
  slug: string;
  dirName: string | undefined;
  variant: string;
  body: React.ReactNode;
  categories: string[];
  author: string;
  pro?: boolean;
  price?: number;
  commission?: number;
  feeType?: AppType["feeType"];
  docs?: string;
  website?: string;
  email: string; // required
  tos?: string;
  privacy?: string;
  licenseRequired: AppType["licenseRequired"];
  teamsPlanRequired: AppType["teamsPlanRequired"];
  descriptionItems?: Array<string | { iframe: IframeHTMLAttributes<HTMLIFrameElement> }>;
  isTemplate?: boolean;
  disableInstall?: boolean;
  dependencies?: string[];
  concurrentMeetings: AppType["concurrentMeetings"];
  paid?: AppType["paid"];
};

export const AppPage = ({
  name,
  type,
  logo,
  slug,
  variant,
  body,
  categories,
  author,
  price = 0,
  commission,
  isGlobal = false,
  feeType,
  docs,
  website,
  email,
  tos,
  privacy,
  teamsPlanRequired,
  descriptionItems,
  isTemplate,
  dependencies,
  concurrentMeetings,
  paid,
  dirName,
}: AppPageProps) => {
  const { t, i18n } = useLocale();
  const router = useRouter();
  const searchParams = useCompatSearchParams();

  const hasDescriptionItems = descriptionItems && descriptionItems.length > 0;

  const mutation = useAddAppMutation(null, {
    onSuccess: (data) => {
      if (data?.setupPending) return;
      setIsLoading(false);
      showToast(t("app_successfully_installed"), "success");
    },
    onError: (error) => {
      if (error instanceof Error) showToast(error.message || t("app_could_not_be_installed"), "error");
      setIsLoading(false);
    },
  });

  /**
   * @todo Refactor to eliminate the isLoading state by using mutation.isPending directly.
   * Currently, the isLoading state is used to manage the loading indicator due to the delay in loading the next page,
   * which is caused by heavy queries in getServersideProps. This causes the loader to turn off before the page changes.
   */
  const [isLoading, setIsLoading] = useState<boolean>(mutation.isPending);

  const handleAppInstall = async () => {
    setIsLoading(true);
    if (isConferencing(categories)) {
      const onBoardingUrl = await getAppOnboardingUrl({
        slug: slug,
        step: AppOnboardingSteps.EVENT_TYPES_STEP,
      });
      mutation.mutate({
        type,
        variant,
        slug,
        returnTo: WEBAPP_URL + onBoardingUrl,
      });
    } else if (
      !doesAppSupportTeamInstall({
        appCategories: categories,
        concurrentMeetings: concurrentMeetings,
        isPaid: !!paid,
      })
    ) {
      mutation.mutate({ type });
    } else {
      const onBoardingUrl = await getAppOnboardingUrl({
        slug: slug,
        step: AppOnboardingSteps.ACCOUNTS_STEP,
      });

      router.push(onBoardingUrl);
    }
  };

  const priceInDollar = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    useGrouping: false,
  }).format(price);

  const [existingCredentials, setExistingCredentials] = useState<number[]>([]);
  const [showDisconnectIntegration, setShowDisconnectIntegration] = useState(false);
  const [ohChatAppCredentials, setOhChatAppCredentials] = useState(undefined);
  const appDbQuery = trpc.viewer.appCredentialsByType.useQuery({ appType: type });

  useEffect(
    function refactorMeWithoutEffect() {
      const data = appDbQuery.data;

      const credentialsCount = data?.credentials.length || 0;
      setShowDisconnectIntegration(
        data?.userAdminTeams.length ? credentialsCount >= data?.userAdminTeams.length : credentialsCount > 0
      );
      setExistingCredentials(data?.credentials.map((credential) => credential.id) || []);
      if (slug === "onehash-chat")
        setOhChatAppCredentials(
          data?.credentials.map((c) => {
            return { ...c.key, credentialId: c.id };
          }) || []
        );
    },
    [appDbQuery.data]
  );

  const dependencyData = trpc.viewer.appsRouter.queryForDependencies.useQuery(dependencies, {
    enabled: !!dependencies,
  });

  const disableInstall =
    dependencyData.data && dependencyData.data.some((dependency) => !dependency.installed);

  // const disableInstall = requiresGCal && !gCalInstalled.data;

  // variant not other allows, an app to be shown in calendar category without requiring an actual calendar connection e.g. vimcal
  // Such apps, can only be installed once.
  const allowedMultipleInstalls = categories.indexOf("calendar") > -1 && variant !== "other";
  // const allowedMultipleInstalls = true;
  useEffect(() => {
    if (searchParams?.get("defaultInstall") === "true") {
      mutation.mutate({ type, variant, slug, defaultInstall: true });
    }
  }, []);

  return (
    <div className="relative flex-1 flex-col items-start justify-start px-4 md:flex md:px-8 lg:flex-row lg:px-0">
      {hasDescriptionItems && (
        <div className="align-center bg-subtle -ml-4 -mr-4 mb-4 flex min-h-[450px] w-auto basis-3/5 snap-x snap-mandatory flex-row overflow-auto whitespace-nowrap p-4  md:-ml-8 md:-mr-8 md:mb-8 md:p-8 lg:mx-0 lg:mb-0 lg:max-w-2xl lg:flex-col lg:justify-center lg:rounded-md">
          {descriptionItems ? (
            descriptionItems.map((descriptionItem, index) =>
              typeof descriptionItem === "object" ? (
                <div
                  key={`iframe-${index}`}
                  className="mr-4 max-h-full min-h-[315px] min-w-[90%] max-w-full snap-center overflow-hidden rounded-md last:mb-0 lg:mb-4 lg:mr-0 [&_iframe]:h-full [&_iframe]:min-h-[315px] [&_iframe]:w-full">
                  <iframe allowFullScreen {...descriptionItem.iframe} />
                </div>
              ) : (
                <Image
                  key={descriptionItem}
                  src={descriptionItem}
                  alt={`Screenshot of app ${name}`}
                  className="mr-4 h-auto max-h-80 max-w-[90%] snap-center rounded-md object-contain last:mb-0 md:max-h-min lg:mb-4 lg:mr-0 lg:max-w-full"
                  width={800} // Example width, adjust according to your design or aspect ratio
                  height={600} // Example height, adjust according to your design or aspect ratio
                />
              )
            )
          ) : (
            <SkeletonText />
          )}
        </div>
      )}
      <div
        className={classNames(
          "sticky top-0 -mt-4 max-w-xl basis-2/5 pb-12 text-sm lg:pb-0",
          hasDescriptionItems && "lg:ml-8"
        )}>
        <div className="mb-8 flex pt-4">
          <header>
            <div className="mb-4 flex items-center">
              <Image
                className={classNames(logo.includes("-dark") && "dark:invert", "h-16 min-h-16 w-16 min-w-16")}
                src={logo}
                alt={name}
                width={64}
                height={64}
              />
              <h1 className="font-cal text-emphasis ml-4 text-3xl">{name}</h1>
            </div>
            <h2 className="text-default text-sm font-medium">
              <Link
                href={`categories/${categories[0]}`}
                className="bg-subtle text-emphasis rounded-md p-1 text-xs capitalize">
                {categories[0]}
              </Link>{" "}
              {paid && (
                <>
                  <Badge className="mr-1">
                    {Intl.NumberFormat(i18n.language, {
                      style: "currency",
                      currency: "USD",
                      useGrouping: false,
                      maximumFractionDigits: 0,
                    }).format(paid.priceInUsd)}
                    /{t("month")}
                  </Badge>
                </>
              )}
              •{" "}
              <a target="_blank" rel="noreferrer" href={website}>
                {t("published_by", { author })}
              </a>
            </h2>
            {isTemplate && (
              <Badge variant="red" className="mt-4">
                Template - Available in Dev Environment only for testing
              </Badge>
            )}
          </header>
        </div>
        {!appDbQuery.isPending ? (
          // Edge case for prop.slug === "onehash-chat"
          slug === "onehash-chat" ? (
            <div className="flex space-x-3">
              <Button
                color="primary"
                onClick={() => {
                  window.location.href = ONEHASH_CHAT_INTEGRATION_PAGE;
                }}
                loading={isLoading}>
                {existingCredentials.length > 0 ? t("install_another") : t("install_app")}
              </Button>
              {existingCredentials.length > 0 && (
                <>
                  <Dropdown modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button color="secondary">{t("remove_app")}</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {ohChatAppCredentials?.map((c, i) => {
                        return (
                          <div
                            className="flex w-full gap-2 p-2"
                            key={`${c.account_name}-${c.account_user_id}`}>
                            <div className="mx-2 w-full text-start">
                              <p>User : {c.user_email}</p>
                              <p className="font-semibold text-indigo-600">Account: {c.account_name}</p>
                            </div>

                            <DisconnectIntegration
                              buttonProps={{ color: "secondary" }}
                              label={t("disconnect")}
                              credentialId={c.credentialId}
                              onSuccess={() => {
                                appDbQuery.refetch();
                              }}
                            />
                          </div>
                          // <DropdownMenuItem key={`${c.account_name}-${c.account_user_id}`}>
                          //   <DropdownItem
                          //     type="button"
                          //     onClick={() => {
                          //       if (disButtonRef.current[i]) {
                          //         disButtonRef.current[i].click();
                          //       }
                          //     }}>
                          //     <div className="flex w-full gap-2">
                          // <div className="mx-2 w-full text-start">
                          //   <p>User : {c.user_email}</p>
                          //   <p className="font-semibold text-indigo-600">Account: {c.account_name}</p>
                          // </div>

                          //     </div>
                          //   </DropdownItem>
                          // </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </Dropdown>
                </>
              )}
            </div>
          ) : (
            // Original logic for other cases
            isGlobal ||
            (existingCredentials.length > 0 && allowedMultipleInstalls ? (
              <div className="flex space-x-3">
                <Button StartIcon="check" color="secondary" disabled>
                  {existingCredentials.length > 0
                    ? t("active_install", { count: existingCredentials.length })
                    : t("default")}
                </Button>
                {!isGlobal && (
                  <InstallAppButton
                    type={type}
                    disableInstall={disableInstall}
                    teamsPlanRequired={teamsPlanRequired}
                    render={({ useDefaultComponent, ...props }) => {
                      if (useDefaultComponent) {
                        props = {
                          ...props,
                          onClick: async () => {
                            await handleAppInstall();
                          },
                          loading: isLoading,
                        };
                      }
                      return <InstallAppButtonChild multiInstall paid={paid} {...props} />;
                    }}
                  />
                )}
              </div>
            ) : showDisconnectIntegration ? (
              <DisconnectIntegration
                buttonProps={{ color: "secondary" }}
                label={t("disconnect")}
                credentialId={existingCredentials[0]}
                onSuccess={() => {
                  appDbQuery.refetch();
                }}
              />
            ) : (
              <InstallAppButton
                type={type}
                disableInstall={disableInstall}
                teamsPlanRequired={teamsPlanRequired}
                render={({ useDefaultComponent, ...props }) => {
                  if (useDefaultComponent) {
                    props = {
                      ...props,
                      onClick: async () => {
                        await handleAppInstall();
                      },
                      loading: isLoading,
                    };
                  }
                  return (
                    <InstallAppButtonChild
                      credentials={appDbQuery.data?.credentials}
                      paid={paid}
                      {...props}
                    />
                  );
                }}
              />
            ))
          )
        ) : (
          <SkeletonButton className="h-10 w-24" />
        )}

        {dependencies &&
          (!dependencyData.isPending ? (
            <div className="mt-6">
              <AppDependencyComponent appName={name} dependencyData={dependencyData.data} />
            </div>
          ) : (
            <SkeletonButton className="mt-6 h-20 grow" />
          ))}

        {price !== 0 && !paid && (
          <span className="block text-right">
            {feeType === "usage-based" ? `${commission}% + ${priceInDollar}/booking` : priceInDollar}
            {feeType === "monthly" && `/${t("month")}`}
          </span>
        )}

        <div className="prose-sm prose prose-a:text-default prose-headings:text-emphasis prose-code:text-default prose-strong:text-default text-default mt-8">
          {body}
        </div>
        {!paid && (
          <>
            <h4 className="text-emphasis mt-8 font-semibold ">{t("pricing")}</h4>
            <span className="text-default">
              {teamsPlanRequired ? (
                t("teams_plan_required")
              ) : price === 0 ? (
                t("free_to_use_apps")
              ) : (
                <>
                  {Intl.NumberFormat(i18n.language, {
                    style: "currency",
                    currency: "USD",
                    useGrouping: false,
                  }).format(price)}
                  {feeType === "monthly" && `/${t("month")}`}
                </>
              )}
            </span>
          </>
        )}

        <h4 className="text-emphasis mb-2 mt-8 font-semibold ">{t("contact")}</h4>
        <ul className="prose-sm -ml-1 -mr-1 leading-5">
          {docs && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="text-emphasis text-sm font-normal no-underline hover:underline"
                href={docs}>
                <Icon name="book-open" className="text-subtle -mt-1 mr-1 inline h-4 w-4" />
                {t("documentation")}
              </a>
            </li>
          )}
          {website && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="text-emphasis font-normal no-underline hover:underline"
                href={website}>
                <Icon name="external-link" className="text-subtle -mt-px mr-1 inline h-4 w-4" />
                {website.replace("https://", "")}
              </a>
            </li>
          )}
          {email && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="text-emphasis font-normal no-underline hover:underline"
                href={`mailto:${email}`}>
                <Icon name="mail" className="text-subtle -mt-px mr-1 inline h-4 w-4" />

                {email}
              </a>
            </li>
          )}
          {tos && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="text-emphasis font-normal no-underline hover:underline"
                href={tos}>
                <Icon name="file" className="text-subtle -mt-px mr-1 inline h-4 w-4" />
                {t("terms_of_service")}
              </a>
            </li>
          )}
          {privacy && (
            <li>
              <a
                target="_blank"
                rel="noreferrer"
                className="text-emphasis font-normal no-underline hover:underline"
                href={privacy}>
                <Icon name="shield" className="text-subtle -mt-px mr-1 inline h-4 w-4" />
                {t("privacy_policy")}
              </a>
            </li>
          )}
        </ul>
        <hr className="border-subtle my-8 border" />
        <span className="leading-1 text-subtle block text-xs">
          {t("every_app_published", { appName: APP_NAME, companyName: COMPANY_NAME })}
        </span>
        <a className="mt-2 block text-xs text-red-500" href={`mailto:${SUPPORT_MAIL_ADDRESS}`}>
          <Icon name="flag" className="inline h-3 w-3" /> {t("report_app")}
        </a>
      </div>
    </div>
  );
};
