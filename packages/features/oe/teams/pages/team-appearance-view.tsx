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

type BrandColorsFormValues = {
  brandColor: string;
  darkBrandColor: string;
};

type BannerFormValues = {
  bannerUrl: string | null;
};

type FaviconFormValues = {
  faviconUrl: string | null;
};
type ProfileViewProps = { team: RouterOutputs["viewer"]["teams"]["get"] };

const ProfileView = ({ team }: ProfileViewProps) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const [hideBrandingValue, setHideBrandingValue] = useState(team?.hideBranding ?? false);
  const [hideBookATeamMember, setHideBookATeamMember] = useState(team?.hideBookATeamMember ?? false);

  const themeForm = useForm<{ theme: string | null | undefined }>({
    defaultValues: {
      theme: team?.theme,
    },
  });

  const {
    formState: { isSubmitting: isThemeSubmitting, isDirty: isThemeDirty },
    reset: resetTheme,
  } = themeForm;

  const brandColorsFormMethods = useForm<BrandColorsFormValues>({
    defaultValues: {
      brandColor: team?.brandColor || DEFAULT_LIGHT_BRAND_COLOR,
      darkBrandColor: team?.darkBrandColor || DEFAULT_DARK_BRAND_COLOR,
    },
  });

  const { reset: resetBrandColors } = brandColorsFormMethods;

  const bannerFormMethods = useForm({
    defaultValues: {
      bannerUrl: team.bannerUrl,
    },
  });

  const {
    formState: { isSubmitting: isBannerFormSubmitting, isDirty: isBannerFormDirty },
  } = bannerFormMethods;

  const onBannerFormSubmit = (values: BannerFormValues) => {
    if (values.bannerUrl === null) {
      values.bannerUrl = "delete";
    }
    mutation.mutate({ ...values, id: team.id });
  };

  const faviconFormMethods = useForm({
    defaultValues: {
      faviconUrl: team.faviconUrl,
    },
  });

  const {
    formState: { isSubmitting: isFaviconFormSubmitting, isDirty: isFaviconFormDirty },
  } = faviconFormMethods;

  const onFaviconFormSubmit = (values: FaviconFormValues) => {
    if (values.faviconUrl === null) {
      values.faviconUrl = "delete";
    }
    mutation.mutate({ ...values, id: team.id });
  };

  const mutation = trpc.viewer.teams.update.useMutation({
    onError: (err) => {
      showToast(err.message, "error");
    },
    async onSuccess(res) {
      await utils.viewer.teams.get.invalidate();
      if (res) {
        resetTheme({ theme: res.theme });
        resetBrandColors({
          brandColor: res.brandColor ?? DEFAULT_LIGHT_BRAND_COLOR,
          darkBrandColor: res.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR,
        });
      }

      showToast(t("your_team_updated_successfully"), "success");
    },
  });

  const onBrandColorsFormSubmit = (values: BrandColorsFormValues) => {
    mutation.mutate({ ...values, id: team.id });
  };

  const isAdmin =
    team && (team.membership.role === MembershipRole.OWNER || team.membership.role === MembershipRole.ADMIN);

  return (
    <>
      {isAdmin ? (
        <>
          <Form
            form={themeForm}
            handleSubmit={({ theme }) => {
              mutation.mutate({
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
                register={themeForm.register}
              />
              <ThemeLabel
                variant="light"
                value="light"
                label={t("light")}
                defaultChecked={team.theme === "light"}
                register={themeForm.register}
              />
              <ThemeLabel
                variant="dark"
                value="dark"
                label={t("dark")}
                defaultChecked={team.theme === "dark"}
                register={themeForm.register}
              />
            </div>
            <SectionBottomActions className="mb-6" align="end">
              <Button
                disabled={isThemeSubmitting || !isThemeDirty}
                type="submit"
                data-testid="update-org-theme-btn"
                color="primary">
                {t("update")}
              </Button>
            </SectionBottomActions>
          </Form>

          <Form
            form={brandColorsFormMethods}
            handleSubmit={(values) => {
              onBrandColorsFormSubmit(values);
            }}>
            <BrandThemeEditor
              onSubmit={onBrandColorsFormSubmit}
              brandColor={team?.brandColor ?? DEFAULT_LIGHT_BRAND_COLOR}
              darkBrandColor={team?.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR}
            />
          </Form>

          <div className="mt-6 flex flex-col gap-6">
            <SettingsToggle
              toggleSwitchAtTheEnd={true}
              title={t("disable_cal_branding", { appName: COMPANY_NAME })}
              disabled={mutation?.isPending}
              description={t("removes_cal_branding", { appName: COMPANY_NAME })}
              checked={hideBrandingValue}
              onCheckedChange={(checked) => {
                setHideBrandingValue(checked);
                mutation.mutate({ id: team.id, hideBranding: checked });
              }}
            />

            <Form
              form={bannerFormMethods}
              handleSubmit={(values) => {
                onBannerFormSubmit(values);
              }}>
              <Controller
                control={bannerFormMethods.control}
                name="bannerUrl"
                render={({ field: { value, onChange } }) => {
                  const showRemoveAvatarButton = !!value;

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
                                {showRemoveAvatarButton && (
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
                            loading={mutation.isPending}
                            disabled={isBannerFormSubmitting || !isBannerFormDirty}
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
              form={faviconFormMethods}
              handleSubmit={(values) => {
                onFaviconFormSubmit(values);
              }}>
              <Controller
                control={faviconFormMethods.control}
                name="faviconUrl"
                render={({ field: { value, onChange } }) => {
                  const showRemoveFaviconButton = !!value;

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
                                  handleAvatarChange={(newAvatar) => {
                                    onChange(newAvatar);
                                  }}
                                  imageSrc={getBrandLogoUrl({ bannerUrl: value }, true)}
                                />

                                {showRemoveFaviconButton && (
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
                            loading={mutation.isPending}
                            disabled={isFaviconFormSubmitting || !isFaviconFormDirty}
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
              disabled={mutation?.isPending}
              description={t("hide_book_a_team_member_description", { appName: APP_NAME })}
              checked={hideBookATeamMember ?? false}
              onCheckedChange={(checked) => {
                setHideBookATeamMember(checked);
                mutation.mutate({ id: team.id, hideBookATeamMember: checked });
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
  const router = useRouter();
  const params = useParamsWithFallback();

  const { t } = useLocale();

  const {
    data: team,
    isPending,
    error,
  } = trpc.viewer.teams.get.useQuery(
    { teamId: Number(params.id) },
    {
      enabled: !!Number(params.id),
    }
  );

  useEffect(
    function refactorMeWithoutEffect() {
      if (error) {
        router.replace("/teams");
      }
    },
    [error]
  );

  if (isPending) return <AppearanceSkeletonLoader />;

  if (!team) return null;

  return <ProfileView team={team} />;
};

export default ProfileViewWrapper;
