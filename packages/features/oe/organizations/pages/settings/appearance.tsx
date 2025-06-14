"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { AppearanceSkeletonLoader } from "@calcom/features/oe/components/AppearanceSkeletonLoader";
import BrandThemeEditor from "@calcom/features/oe/components/BrandThemeEditor";
import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import ThemeLabel from "@calcom/features/settings/ThemeLabel";
import { DEFAULT_LIGHT_BRAND_COLOR, DEFAULT_DARK_BRAND_COLOR } from "@calcom/lib/constants";
import { COMPANY_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import { trpc } from "@calcom/trpc/react";
import type { RouterOutputs } from "@calcom/trpc/react";
import { Button, Form, showToast, SettingsToggle } from "@calcom/ui";

type BrandColorsFormValues = {
  brandColor: string;
  darkBrandColor: string;
};

const OrgAppearanceView = ({
  currentOrg,
}: {
  currentOrg: RouterOutputs["viewer"]["organizations"]["listCurrent"];
  isAdminOrOwner: boolean;
}) => {
  const { t } = useLocale();
  const utils = trpc.useUtils();

  const themeForm = useForm<{ theme: string | null | undefined }>({
    defaultValues: {
      theme: currentOrg?.theme,
    },
  });

  const {
    formState: { isSubmitting: isOrgThemeSubmitting, isDirty: isOrgThemeDirty },
    reset: resetOrgThemeReset,
  } = themeForm;

  const [hideBrandingValue, setHideBrandingValue] = useState(currentOrg?.hideBranding ?? false);
  const [allowSEOIndexingValue, setAllowSEOIndexingValue] = useState(
    currentOrg?.organizationSettings?.allowSEOIndexing ?? false
  );
  const [orgProfileRedirectsToVerifiedDomainValue, setOrgProfileRedirectsToVerifiedDomainValue] = useState(
    currentOrg?.organizationSettings?.orgProfileRedirectsToVerifiedDomain ?? false
  );

  const brandColorsFormMethods = useForm<BrandColorsFormValues>({
    defaultValues: {
      brandColor: currentOrg?.brandColor || DEFAULT_LIGHT_BRAND_COLOR,
      darkBrandColor: currentOrg?.darkBrandColor || DEFAULT_DARK_BRAND_COLOR,
    },
  });

  const mutation = trpc.viewer.organizations.update.useMutation({
    onError: (err) => {
      showToast(err.message, "error");
    },
    async onSuccess(res) {
      await utils.viewer.teams.get.invalidate();
      await utils.viewer.organizations.listCurrent.invalidate();

      showToast(t("your_team_updated_successfully"), "success");
      if (res) {
        brandColorsFormMethods.reset({
          brandColor: res.data.brandColor as string,
          darkBrandColor: res.data.darkBrandColor as string,
        });
        resetOrgThemeReset({ theme: res.data.theme as string | undefined });
      }
    },
  });

  const onBrandColorsFormSubmit = (values: BrandColorsFormValues) => {
    mutation.mutate(values);
  };

  return (
    <div>
      <Form
        form={themeForm}
        handleSubmit={({ theme }) => {
          if (theme === "light" || theme === "dark") {
            mutation.mutate({
              theme,
            });
            return;
          }
          mutation.mutate({
            theme: null,
          });
        }}>
        <div className="border-subtle mt-6 flex items-center rounded-t-xl border p-6 text-sm">
          <div>
            <p className="text-default text-base font-semibold">{t("theme")}</p>
            <p className="text-default">{t("theme_applies_note")}</p>
          </div>
        </div>
        <div className="border-subtle flex flex-col justify-between border-x px-6 py-8 sm:flex-row">
          <ThemeLabel
            variant="system"
            value="system"
            label={t("theme_system")}
            defaultChecked={currentOrg.theme === null}
            register={themeForm.register}
          />
          <ThemeLabel
            variant="light"
            value="light"
            label={t("light")}
            defaultChecked={currentOrg.theme === "light"}
            register={themeForm.register}
          />
          <ThemeLabel
            variant="dark"
            value="dark"
            label={t("dark")}
            defaultChecked={currentOrg.theme === "dark"}
            register={themeForm.register}
          />
        </div>
        <SectionBottomActions className="mb-6" align="end">
          <Button
            disabled={isOrgThemeSubmitting || !isOrgThemeDirty}
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
          brandColor={currentOrg?.brandColor ?? DEFAULT_LIGHT_BRAND_COLOR}
          darkBrandColor={currentOrg?.darkBrandColor ?? DEFAULT_DARK_BRAND_COLOR}
        />
      </Form>

      <SettingsToggle
        toggleSwitchAtTheEnd={true}
        title={t("disable_cal_branding", { appName: COMPANY_NAME })}
        disabled={mutation?.isPending}
        description={t("removes_cal_branding", { appName: COMPANY_NAME })}
        checked={hideBrandingValue}
        onCheckedChange={(checked) => {
          setHideBrandingValue(checked);
          mutation.mutate({ hideBranding: checked });
        }}
        switchContainerClassName="mt-6"
      />

      <SettingsToggle
        data-testid={`${currentOrg?.id}-seo-indexing-switch`}
        toggleSwitchAtTheEnd={true}
        title={t("seo_indexing")}
        description={t("allow_seo_indexing")}
        disabled={mutation.isPending}
        checked={allowSEOIndexingValue}
        onCheckedChange={(checked) => {
          setAllowSEOIndexingValue(checked);
          mutation.mutate({ allowSEOIndexing: checked });
        }}
        switchContainerClassName="mt-6"
      />

      <SettingsToggle
        toggleSwitchAtTheEnd={true}
        title={t("disable_org_url_label")}
        description={t("disable_org_url_description", {
          orgSlug: currentOrg?.slug,
          destination: currentOrg?.organizationSettings?.orgAutoAcceptEmail,
        })}
        disabled={mutation.isPending}
        checked={orgProfileRedirectsToVerifiedDomainValue}
        onCheckedChange={(checked) => {
          setOrgProfileRedirectsToVerifiedDomainValue(checked);
          mutation.mutate({ orgProfileRedirectsToVerifiedDomain: checked });
        }}
        switchContainerClassName="mt-6"
      />
    </div>
  );
};

const OrgAppearanceViewWrapper = () => {
  const router = useRouter();
  const session = useSession();
  const orgRole = session?.data?.user?.org?.role;
  const { data: currentOrg, isPending, error } = trpc.viewer.organizations.listCurrent.useQuery();

  useEffect(
    function refactorMeWithoutEffect() {
      if (error) {
        router.replace("/enterprise");
      }
    },
    [error]
  );

  if (isPending) {
    return <AppearanceSkeletonLoader />;
  }

  if (!currentOrg) return null;

  const isAdminOrOwner = orgRole === MembershipRole.OWNER || orgRole === MembershipRole.ADMIN;

  return <OrgAppearanceView currentOrg={currentOrg} isAdminOrOwner={isAdminOrOwner} />;
};

export default OrgAppearanceViewWrapper;
