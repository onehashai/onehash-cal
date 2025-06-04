import { useState, useCallback, useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";

import SectionBottomActions from "@calcom/features/settings/SectionBottomActions";
import { classNames } from "@calcom/lib";
import { DEFAULT_LIGHT_BRAND_COLOR, DEFAULT_DARK_BRAND_COLOR } from "@calcom/lib/constants";
import { checkWCAGContrastColor } from "@calcom/lib/getBrandColours";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Button, ColorPicker, SettingsToggle, Alert } from "@calcom/ui";

interface BrandColorsFormValues {
  brandColor: string;
  darkBrandColor: string;
}

interface BrandColorsFormProps {
  onSubmit: (values: BrandColorsFormValues) => void;
  brandColor: string | undefined;
  darkBrandColor: string | undefined;
}

const BrandThemeEditor = ({ onSubmit, brandColor, darkBrandColor }: BrandColorsFormProps) => {
  const { t } = useLocale();
  const brandColorsFormMethods = useFormContext();
  const {
    formState: { isSubmitting: isBrandColorsFormSubmitting, isDirty: isBrandColorsFormDirty },
  } = brandColorsFormMethods;

  const isCustomColorsInitiallySet = useMemo(
    () => brandColor !== DEFAULT_LIGHT_BRAND_COLOR || darkBrandColor !== DEFAULT_DARK_BRAND_COLOR,
    [brandColor, darkBrandColor]
  );

  const [isCustomBrandColorChecked, setIsCustomBrandColorChecked] = useState(isCustomColorsInitiallySet);
  const [darkModeError, setDarkModeError] = useState(false);
  const [lightModeError, setLightModeError] = useState(false);

  const handleCustomColorToggle = useCallback(
    (checked: boolean) => {
      setIsCustomBrandColorChecked(checked);
      if (!checked) {
        setLightModeError(false);
        setDarkModeError(false);
        onSubmit({
          brandColor: DEFAULT_LIGHT_BRAND_COLOR,
          darkBrandColor: DEFAULT_DARK_BRAND_COLOR,
        });
      }
    },
    [onSubmit]
  );

  const handleLightColorChange = useCallback(
    (value: string) => {
      const hasValidContrast = checkWCAGContrastColor("#ffffff", value);
      setLightModeError(!hasValidContrast);
      brandColorsFormMethods.setValue("brandColor", value, { shouldDirty: true });
    },
    [brandColorsFormMethods]
  );

  const handleDarkColorChange = useCallback(
    (value: string) => {
      const hasValidContrast = checkWCAGContrastColor("#101010", value);
      setDarkModeError(!hasValidContrast);
      brandColorsFormMethods.setValue("darkBrandColor", value, { shouldDirty: true });
    },
    [brandColorsFormMethods]
  );

  const switchContainerClassName = useMemo(
    () =>
      classNames(
        "py-6 px-4 sm:px-6 border-subtle rounded-xl border",
        isCustomBrandColorChecked && "rounded-b-none"
      ),
    [isCustomBrandColorChecked]
  );

  const isUpdateDisabled = isBrandColorsFormSubmitting || !isBrandColorsFormDirty;

  return (
    <div className="mt-6">
      <SettingsToggle
        toggleSwitchAtTheEnd={true}
        title={t("custom_brand_colors")}
        description={t("customize_your_brand_colors")}
        checked={isCustomBrandColorChecked}
        onCheckedChange={handleCustomColorToggle}
        childrenClassName="lg:ml-0"
        switchContainerClassName={switchContainerClassName}>
        <div className="border-subtle flex flex-col gap-6 border-x p-6">
          <Controller
            name="brandColor"
            control={brandColorsFormMethods.control}
            defaultValue={brandColor}
            render={() => (
              <div>
                <p className="text-default mb-2 block text-sm font-medium">{t("light_brand_color")}</p>
                <ColorPicker
                  defaultValue={brandColor || DEFAULT_LIGHT_BRAND_COLOR}
                  resetDefaultValue={DEFAULT_LIGHT_BRAND_COLOR}
                  onChange={handleLightColorChange}
                />
                {lightModeError && (
                  <div className="mt-4">
                    <Alert severity="warning" message={t("light_theme_contrast_error")} />
                  </div>
                )}
              </div>
            )}
          />

          <Controller
            name="darkBrandColor"
            control={brandColorsFormMethods.control}
            defaultValue={darkBrandColor}
            render={() => (
              <div className="mt-6 sm:mt-0">
                <p className="text-default mb-2 block text-sm font-medium">{t("dark_brand_color")}</p>
                <ColorPicker
                  defaultValue={darkBrandColor || DEFAULT_DARK_BRAND_COLOR}
                  resetDefaultValue={DEFAULT_DARK_BRAND_COLOR}
                  onChange={handleDarkColorChange}
                />
                {darkModeError && (
                  <div className="mt-4">
                    <Alert severity="warning" message={t("dark_theme_contrast_error")} />
                  </div>
                )}
              </div>
            )}
          />
        </div>
        <SectionBottomActions align="end">
          <Button disabled={isUpdateDisabled} color="primary" type="submit">
            {t("update")}
          </Button>
        </SectionBottomActions>
      </SettingsToggle>
    </div>
  );
};

export default BrandThemeEditor;
