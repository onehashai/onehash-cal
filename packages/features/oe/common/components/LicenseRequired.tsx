"use client";

import { useSession } from "next-auth/react";
import type { AriaRole, ComponentType } from "react";
import React, { Fragment, useEffect } from "react";

import { WEBAPP_URL } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { EmptyScreen, Alert, Button } from "@calcom/ui";

type LicenseRequiredProps = {
  as?: keyof JSX.IntrinsicElements | "";
  className?: string;
  role?: AriaRole | undefined;
  children: React.ReactNode;
};

function LicenseRequired(properties: LicenseRequiredProps) {
  const { children, as, ...remainingProps } = properties;
  const sessionData = useSession();
  const localizationHook = useLocale();
  const WrapperElement = as === "" || !as ? Fragment : as;

  const licenseStatus = (function () {
    if (!sessionData.data) return null;
    return sessionData.data.hasValidLicense;
  })();

  useEffect(function () {
    const isDevelopment = process.env.NODE_ENV === "development";
    const noValidLicense = licenseStatus === false;

    if (isDevelopment && noValidLicense) {
      const warningMessage = `You're using a feature that requires a valid license. Please go to ${WEBAPP_URL}/auth/setup to enter a license key.`;
      console.info(warningMessage);
    }
  }, []);

  const renderDevelopmentWarning = function () {
    return (
      <React.Fragment>
        <Alert
          className="mb-4"
          severity="warning"
          title={
            <React.Fragment>
              {localizationHook.t("enterprise_license_locally")}{" "}
              {localizationHook.t("enterprise_license_sales")}{" "}
              <a className="underline" href="mailto:support@onehash.ai">
                {localizationHook.t("contact_sales")}
              </a>
            </React.Fragment>
          }
        />
        {children}
      </React.Fragment>
    );
  };

  const renderProductionBlock = function () {
    return (
      <EmptyScreen
        Icon="triangle-alert"
        headline={localizationHook.t("enterprise_license")}
        buttonRaw={
          <Button color="secondary" href="https://go.cal.com/get-license">
            {localizationHook.t("contact_sales")}
          </Button>
        }
        description={localizationHook.t("enterprise_license_sales")}
      />
    );
  };

  const determineContent = function () {
    const hasLicense = licenseStatus === null || licenseStatus === true;

    if (hasLicense) {
      return children;
    }

    const isDevEnvironment = process.env.NODE_ENV === "development";

    if (isDevEnvironment) {
      return renderDevelopmentWarning();
    } else {
      return renderProductionBlock();
    }
  };

  return <WrapperElement {...remainingProps}>{determineContent()}</WrapperElement>;
}

export const withLicenseRequired = function <T extends JSX.IntrinsicAttributes>(
  WrappedComponent: ComponentType<T>
) {
  const EnhancedComponent = function (componentProps: T) {
    return (
      <div>
        <LicenseRequired>
          <WrappedComponent {...componentProps} />
        </LicenseRequired>
      </div>
    );
  };

  return EnhancedComponent;
};

export default LicenseRequired;
