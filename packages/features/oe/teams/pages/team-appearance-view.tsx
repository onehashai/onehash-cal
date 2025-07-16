"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";

import { AppearanceSkeletonLoader } from "@calcom/features/oe/components/AppearanceSkeletonLoader";
import BrandThemeEditor from "@calcom/features/oe/components/BrandThemeEditor";
import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import { classNames } from "@calcom/lib";
import { APP_NAME } from "@calcom/lib/constants";
import { DEFAULT_LIGHT_BRAND_COLOR, DEFAULT_DARK_BRAND_COLOR, COMPANY_NAME } from "@calcom/lib/constants";
import { getBrandLogoUrl } from "@calcom/lib/getAvatarUrl";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useParamsWithFallback } from "@calcom/lib/hooks/useParamsWithFallback";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import type { RouterOutputs } from "@calcom/trpc/react";
import {
  Button,
  Form,
  showToast,
  SettingsToggle,
  ImageUploader,
  Label,
  Avatar,
  BannerUploader,
} from "@calcom/ui";

import ThemeLabel from "../../../settings/ThemeLabel";

interface ColorSchemeFormData {
  brandColor: string;
  darkBrandColor: string;
}

interface HeaderImageFormData {
  bannerUrl: string | null;
}

interface IconFormData {
  faviconUrl: string | null;
}

interface TeamDisplayProps {
  team: RouterOutputs["viewer"]["teams"]["get"];
}

const TeamDisplayComponent = ({ team }: TeamDisplayProps) => {
  const { t } = useLocale();
  const utilities = trpc.useUtils();

  const [brandingVisibility, setBrandingVisibility] = useState(team?.hideBranding ?? false);
  const [memberBookingVisibility, setMemberBookingVisibility] = useState(team?.hideBookATeamMember ?? false);

  const themeFormController = useForm<{ theme: string | null | undefined }>({
    defaultValues: {
      theme: team?.theme,
    },
  });

  const {
    formState: { isSubmitting: themeSubmissionState, isDirty: themeModificationState },
    reset: resetThemeData,
  } = themeFormController;

  const colorSchemeFormController = useForm<ColorSchemeFormData>({
    defaultValues: {
      brandColor: team?.brandColor || DEFAULT_LIGHT_BRAND_COLOR,
      darkBrandColor: team?.darkBrandColor || DEFAULT_DARK_BRAND_COLOR,
    },
  });

  const { reset: resetColorSchemeData } = colorSchemeFormController;

  const headerImageFormController = useForm({
    defaultValues: {
      bannerUrl: team.bannerUrl,
    },
  });

  const {
    formState: { isSubmitting: headerImageSubmissionState, isDirty: headerImageModificationState },
  } = headerImageFormController;

  const processHeaderImageSubmission = (formData: HeaderImageFormData) => {
    if (formData.bannerUrl === null) {
      formData.bannerUrl = "delete";
    }
    updateMutation.mutate({ ...formData, id: team.id });
  };

  const iconFormController = useForm({
    defaultValues: {
      faviconUrl: team.faviconUrl,
    },
  });

  const {
    formState: { isSubmitting: iconSubmissionState, isDirty: iconModificationState },
  } = iconFormController;

  const processIconSubmission = (formData: IconFormData) => {
    if (formData.faviconUrl === null) {
      formData.faviconUrl = "delete";
    }
    updateMutation.mutate({ ...formData, id: team.id });
  };

  const updateMutation = trpc.viewer.teams.update.useMutation({
    onError: (error) => {
      showToast(error.message, "error");
    },
    async onSuccess(response) {
      await utilities.viewer.teams.get.invalidate();
      if (response) {
        resetThemeData({ theme: response.theme });
        resetColorSchemeData({
          brandColor: response.brandColor ?? DEFAULT_LIGHT_BRAND_COLOR,
          darkBrandColor: response.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR,
        });
      }

      showToast(t("your_team_updated_successfully"), "success");
    },
  });

  const processColorSchemeSubmission = (formData: ColorSchemeFormData) => {
    updateMutation.mutate({ ...formData, id: team.id });
  };

  const hasAdministrativeAccess =
    team && (team.membership.role === MembershipRole.OWNER || team.membership.role === MembershipRole.ADMIN);

  return (
    <>
      {hasAdministrativeAccess ? (
        <>
          <Form
            form={themeFormController}
            handleSubmit={({ theme }) => {
              updateMutation.mutate({
                id: team.id,
                theme: theme === "light" || theme === "dark" ? theme : null,
              });
            }}>
            <div className="border-subtle mt-6 flex items-center rounded-t-xl border p-6 text-sm">
              <div>
                <p className="font-semibold">{t("theme")}</p>
                <p className="text-default">{t("theme_applies_note")}</p>
              </div>
            </div>
            <div className="border-subtle flex flex-col justify-between border-x px-6 py-8 sm:flex-row">
              <ThemeLabel
                variant="system"
                value="system"
                label={t("theme_system")}
                defaultChecked={team.theme === null}
                register={themeFormController.register}
              />
              <ThemeLabel
                variant="light"
                value="light"
                label={t("light")}
                defaultChecked={team.theme === "light"}
                register={themeFormController.register}
              />
              <ThemeLabel
                variant="dark"
                value="dark"
                label={t("dark")}
                defaultChecked={team.theme === "dark"}
                register={themeFormController.register}
              />
            </div>
            <SectionBottomActions className="mb-6" align="end">
              <Button
                disabled={themeSubmissionState || !themeModificationState}
                type="submit"
                data-testid="update-org-theme-btn"
                color="primary">
                {t("update")}
              </Button>
            </SectionBottomActions>
          </Form>

          <Form
            form={colorSchemeFormController}
            handleSubmit={(formData) => {
              processColorSchemeSubmission(formData);
            }}>
            <BrandThemeEditor
              onSubmit={processColorSchemeSubmission}
              brandColor={team?.brandColor ?? DEFAULT_LIGHT_BRAND_COLOR}
              darkBrandColor={team?.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR}
            />
          </Form>

          <div className="mt-6 flex flex-col gap-6">
            <SettingsToggle
              toggleSwitchAtTheEnd={true}
              title={t("disable_cal_branding", { appName: COMPANY_NAME })}
              disabled={updateMutation?.isPending}
              description={t("removes_cal_branding", { appName: COMPANY_NAME })}
              checked={brandingVisibility}
              onCheckedChange={(isChecked) => {
                setBrandingVisibility(isChecked);
                updateMutation.mutate({ id: team.id, hideBranding: isChecked });
              }}
            />

            <Form
              form={headerImageFormController}
              handleSubmit={(formData) => {
                processHeaderImageSubmission(formData);
              }}>
              <Controller
                control={headerImageFormController.control}
                name="bannerUrl"
                render={({ field: { value, onChange } }) => {
                  const displayRemoveImageButton = !!value;

                  return (
                    <div className="mt-3">
                      <div
                        className={classNames(
                          "border-subtle flex justify-between space-x-3 rounded-lg border px-4 py-6 sm:px-6",
                          "rounded-b-none"
                        )}>
                        <div>
                          <div className="flex items-center  gap-x-2">
                            <Label
                              className={classNames("mt-0.5 text-base font-semibold leading-none")}
                              htmlFor="">
                              {t("custom_brand_logo")}
                            </Label>
                          </div>
                          <p className={classNames("text-default -mt-1.5 text-sm leading-normal")}>
                            {t("customize_your_brand_logo")}
                          </p>
                        </div>
                      </div>
                      <div className="border-subtle my-auto h-full border  border-t-0 p-6">
                        <div className="flex justify-between">
                          <div className="flex">
                            <Avatar
                              alt={team.name || "Team Brand"}
                              imageSrc={getBrandLogoUrl({ bannerUrl: value })}
                              size="lg"
                            />

                            <div className="ms-4 flex items-center">
                              <div className="flex  gap-2">
                                <BannerUploader
                                  height={100}
                                  width={300}
                                  target="avatar"
                                  uploadInstruction={t("org_banner_instructions", {
                                    height: 100,
                                    width: 300,
                                  })}
                                  id="avatar-upload"
                                  buttonMsg={t("upload_logo")}
                                  handleAvatarChange={onChange}
                                  imageSrc={getBrandLogoUrl({ bannerUrl: value })}
                                />
                                {displayRemoveImageButton && (
                                  <Button
                                    color="secondary"
                                    onClick={() => {
                                      onChange(null);
                                    }}>
                                    <p className="mx-auto">{t("remove")}</p>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            className="my-auto"
                            loading={updateMutation.isPending}
                            disabled={headerImageSubmissionState || !headerImageModificationState}
                            color="primary"
                            type="submit">
                            {t("update")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </Form>
            <Form
              form={iconFormController}
              handleSubmit={(formData) => {
                processIconSubmission(formData);
              }}>
              <Controller
                control={iconFormController.control}
                name="faviconUrl"
                render={({ field: { value, onChange } }) => {
                  const displayRemoveIconButton = !!value;

                  return (
                    <div className="mt-3">
                      <div
                        className={classNames(
                          "border-subtle flex justify-between space-x-3 rounded-lg border px-4 py-6 sm:px-6",
                          "rounded-b-none"
                        )}>
                        <div>
                          <div className="flex items-center  gap-x-2">
                            <Label
                              className={classNames("mt-0.5 text-base font-semibold leading-none")}
                              htmlFor="">
                              {t("custom_brand_favicon")}
                            </Label>
                          </div>
                          <p className={classNames("text-default -mt-1.5 text-sm leading-normal")}>
                            {t("customize_your_brand_favicon")}
                          </p>
                        </div>
                      </div>
                      <div className="border-subtle my-auto h-full border  border-t-0 p-6">
                        <div className="flex justify-between">
                          <div className="flex">
                            <Avatar
                              alt={team.name || "Team Favicon"}
                              imageSrc={getBrandLogoUrl({ faviconUrl: value }, true)}
                              size="lg"
                            />
                            <div className="ms-4 flex items-center">
                              <div className="flex  gap-2">
                                <ImageUploader
                                  target="avatar"
                                  id="avatar-upload"
                                  buttonMsg={t("upload_favicon")}
                                  handleAvatarChange={(newImage) => {
                                    onChange(newImage);
                                  }}
                                  imageSrc={getBrandLogoUrl({ bannerUrl: value }, true)}
                                />

                                {displayRemoveIconButton && (
                                  <Button
                                    color="secondary"
                                    onClick={() => {
                                      onChange(null);
                                    }}>
                                    <p className="mx-auto">{t("remove")}</p>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            className="my-auto"
                            loading={updateMutation.isPending}
                            disabled={iconSubmissionState || !iconModificationState}
                            color="primary"
                            type="submit">
                            {t("update")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </Form>
            <SettingsToggle
              toggleSwitchAtTheEnd={true}
              title={t("hide_book_a_team_member")}
              disabled={updateMutation?.isPending}
              description={t("hide_book_a_team_member_description", { appName: APP_NAME })}
              checked={memberBookingVisibility ?? false}
              onCheckedChange={(isChecked) => {
                setMemberBookingVisibility(isChecked);
                updateMutation.mutate({ id: team.id, hideBookATeamMember: isChecked });
              }}
            />
          </div>
        </>
      ) : (
        <div className="border-subtle rounded-md border p-5">
          <span className="text-default text-sm">{t("only_owner_change")}</span>
        </div>
      )}
    </>
  );
};

const ProfileViewWrapper = () => {
  const navigationRouter = useRouter();
  const routeParameters = useParamsWithFallback();

  const { t } = useLocale();

  const {
    data: teamData,
    isPending: loadingState,
    error: queryError,
  } = trpc.viewer.teams.get.useQuery(
    { teamId: Number(routeParameters.id) },
    {
      enabled: !!Number(routeParameters.id),
    }
  );

  useEffect(
    function handleErrorRedirection() {
      if (queryError) {
        navigationRouter.replace("/teams");
      }
    },
    [queryError]
  );

  if (loadingState) return <AppearanceSkeletonLoader />;

  if (!teamData) return null;

  return <TeamDisplayComponent team={teamData} />;
};

export default ProfileViewWrapper;
