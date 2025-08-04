"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { HOSTED_CAL_FEATURES, WEBAPP_URL, WEBSITE_URL } from "@calcom/lib/constants";
import { emailRegex } from "@calcom/lib/emailSchema";
import { getSafeRedirectUrl } from "@calcom/lib/getSafeRedirectUrl";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Alert, Button, EmailField, PasswordField } from "@calcom/ui";

import type { getServerSideProps } from "@lib/signup/getServerSideProps";
import type { inferSSRProps } from "@lib/types/inferSSRProps";

import AddToHomescreen from "@components/AddToHomescreen";
import AuthContainer from "@components/ui/AuthContainer";

interface SignupValues {
  email: string;
  password: string;
  confirmPassword: string;
  // csrfToken: string;
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.35 11.1H12v2.8h5.37c-.23 1.25-.93 2.3-1.98 3l3.17 2.46c1.85-1.7 2.91-4.2 2.91-7.26 0-.67-.06-1.32-.17-1.95zM12 22c2.43 0 4.47-.8 5.96-2.17l-3.17-2.46c-.88.6-2 .96-3.3.96-2.55 0-4.7-1.72-5.47-4.04H3.71v2.54C5.2 19.95 8.36 22 12 22zM6.53 13.29c-.2-.6-.31-1.25-.31-1.91s.11-1.31.31-1.91V6.93H3.71A9.98 9.98 0 0 0 2 11.38c0 1.59.38 3.09 1.04 4.45l2.49-2.54zM12 4.98c1.32 0 2.52.46 3.46 1.36l2.6-2.6C16.45 2.39 14.4 1.5 12 1.5 8.36 1.5 5.2 3.55 3.71 6.93l2.82 2.54C7.3 6.7 9.45 4.98 12 4.98z" />
  </svg>
);

const AppleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export type PageProps = inferSSRProps<typeof getServerSideProps>;
function addOrUpdateQueryParam(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  const param = `${key}=${encodeURIComponent(value)}`;
  return `${url}${separator}${param}`;
}
export default function Signup(props: PageProps) {
  const {
    isGoogleLoginEnabled,
    isSAMLLoginEnabled,
    prepopulateFormValues,
    emailVerificationEnabled,
    isAppleLoginEnabled,
    isMicrosoftLoginEnabled,
    isGitHubLoginEnabled,
  } = props;
  const searchParams = useCompatSearchParams();
  const { t } = useLocale();
  const router = useRouter();

  const formSchema = z
    .object({
      email: z
        .string()
        .min(1, `${t("error_required_field")}`)
        .regex(emailRegex, `${t("enter_valid_email")}`),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          "Password must contain at least one uppercase letter, one lowercase letter, and one number"
        ),
      confirmPassword: z.string().min(1, `${t("error_required_field")}`),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });

  const methods = useForm<SignupValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: prepopulateFormValues?.email || "",
    },
    mode: "onChange",
  });
  const { register, formState, watch } = methods;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const errorMessages: { [key: string]: string } = {
    [ErrorCode.UserNotFound]: t("no_account_exists"),
    [ErrorCode.IncorrectEmailPassword]: t("incorrect_email_password"),
    [ErrorCode.InternalServerError]: `${t("something_went_wrong")} ${t("please_try_again_and_contact_us")}`,
    [ErrorCode.NewPasswordMatchesOld]: t("new_password_matches_old_password"),
    [ErrorCode.ThirdPartyIdentityProviderEnabled]: t("account_created_with_identity_provider"),
  };

  let callbackUrl = searchParams?.get("callbackUrl") || "";

  const cleanCallbackUrl = () => {
    if (!callbackUrl) return;
    if (/"\//.test(callbackUrl)) callbackUrl = callbackUrl.substring(1);
    const safeCallbackUrl = getSafeRedirectUrl(callbackUrl);
    callbackUrl = safeCallbackUrl || "";
  };

  useEffect(() => {
    if (!callbackUrl) return;
    cleanCallbackUrl();
  }, [callbackUrl]);

  const SignupFooter = (
    <Link href={`${WEBSITE_URL}/auth/login`} className="text-brand-500 font-medium">
      {t("already_have_account")}
    </Link>
  );

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: "", color: "" };

    let strength = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    strength = Object.values(checks).filter(Boolean).length;

    if (strength <= 2) return { strength, label: "Weak", color: "text-red-600" };
    if (strength <= 3) return { strength, label: "Fair", color: "text-yellow-600" };
    if (strength <= 4) return { strength, label: "Good", color: "text-blue-600" };
    return { strength, label: "Strong", color: "text-green-600" };
  };

  const passwordStrength = getPasswordStrength(password || "");

  const onSubmit = async (values: SignupValues) => {
    setErrorMessage(null);

    try {
      const { confirmPassword, ...submitValues } = values;

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...submitValues,
          language: "en",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMessage = errorMessages[data.message] || data.message || t("something_went_wrong");
        setErrorMessage(errorMessage);
      } else {
        const verifyOrGettingStarted = emailVerificationEnabled ? "auth/verify-email" : "getting-started";

        const constructCallBackIfUrlPresent = () => {
          // if (isOrgInviteByLink) {
          //   return `${WEBAPP_URL}/${searchParams.get("callbackUrl")}`;
          // }

          return addOrUpdateQueryParam(`${WEBAPP_URL}/${searchParams.get("callbackUrl")}`, "from", "signup");
        };

        const constructCallBackIfUrlNotPresent = () => {
          return `${WEBAPP_URL}/${verifyOrGettingStarted}?from=signup`;
        };

        const constructCallBackUrl = () => {
          const callbackUrlSearchParams = searchParams?.get("callbackUrl");

          return !!callbackUrlSearchParams
            ? constructCallBackIfUrlPresent()
            : constructCallBackIfUrlNotPresent();
        };

        const callbackUrl = constructCallBackUrl();

        // await signIn<"credentials">("credentials", {
        //   ...submitValues,
        //   callbackUrl,
        // });
        // Auto sign in after successful signup
        await signIn<"credentials">("credentials", {
          email: values.email,
          password: values.password,
          callbackUrl,
        });
      }
    } catch (error: any) {
      setErrorMessage(error.message || t("something_went_wrong"));
    }
  };

  const handleSSOSignup = async (provider: string) => {
    await signIn(provider, {
      callbackUrl,
    });
  };

  const { data, isPending, error } = trpc.viewer.public.ssoConnections.useQuery();

  useEffect(() => {
    if (error) {
      setErrorMessage(error.message);
    }
  }, [error]);

  const displaySSOLogin = HOSTED_CAL_FEATURES
    ? true
    : isSAMLLoginEnabled && !isPending && data?.connectionExists;

  const ssoProviders = [
    { id: "google", name: "Google", icon: GoogleIcon, enabled: isGoogleLoginEnabled },
    { id: "apple", name: "Apple", icon: AppleIcon, enabled: isAppleLoginEnabled },
    { id: "azure-ad-b2c", name: "Microsoft", icon: MicrosoftIcon, enabled: isMicrosoftLoginEnabled },
    { id: "github", name: "GitHub", icon: GitHubIcon, enabled: isGitHubLoginEnabled },
  ].filter((provider) => provider.enabled);

  return (
    <div className="dark:bg-brand dark:text-brand-contrast text-emphasis min-h-screen [--cal-brand-emphasis:#101010] [--cal-brand-subtle:#9CA3AF] [--cal-brand-text:white] [--cal-brand:#111827] dark:[--cal-brand-emphasis:#e1e1e1] dark:[--cal-brand-text:black] dark:[--cal-brand:white]">
      <AuthContainer showLogo heading={t("create_your_account")} footerText={SignupFooter}>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate data-testid="signup-form">
            {/* <div>
              <input defaultValue={csrfToken || undefined} type="hidden" hidden {...register("csrfToken")} />
            </div> */}
            <div className="space-y-6">
              <EmailField
                id="email"
                label={t("email_address")}
                defaultValue={prepopulateFormValues?.email || (searchParams?.get("email") as string)}
                placeholder="john.doe@example.com"
                required
                autoComplete="email"
                {...register("email")}
              />

              <div>
                <PasswordField
                  id="password"
                  label={t("password")}
                  autoComplete="new-password"
                  required
                  className="mb-0"
                  {...register("password")}
                />
                {password && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Password strength:</span>
                      <span className={`text-sm font-medium ${passwordStrength.color}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-2 w-full rounded ${
                            level <= passwordStrength.strength
                              ? passwordStrength.strength <= 2
                                ? "bg-red-500"
                                : passwordStrength.strength <= 3
                                ? "bg-yellow-500"
                                : passwordStrength.strength <= 4
                                ? "bg-blue-500"
                                : "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p className={password.length >= 8 ? "text-green-600" : ""}>✓ At least 8 characters</p>
                      <p className={/[a-z]/.test(password) ? "text-green-600" : ""}>✓ One lowercase letter</p>
                      <p className={/[A-Z]/.test(password) ? "text-green-600" : ""}>✓ One uppercase letter</p>
                      <p className={/\d/.test(password) ? "text-green-600" : ""}>✓ One number</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <PasswordField
                  id="confirmPassword"
                  label="Confirm Password"
                  autoComplete="new-password"
                  required
                  className="mb-0"
                  {...register("confirmPassword")}
                />
                {confirmPassword && password && (
                  <div className="mt-1">
                    {password === confirmPassword && (
                      <p className="flex items-center text-sm text-green-600">
                        <span className="mr-1">✓</span>
                        Passwords match
                      </p>
                    )}
                  </div>
                )}
              </div>

              {errorMessage && <Alert severity="error" title={errorMessage} />}

              <Button
                type="submit"
                color="secondary"
                disabled={formState.isSubmitting || !formState.isValid}
                className="w-full justify-center">
                <span>{t("create_account")}</span>
              </Button>

              {/* SSO Signup Options */}
              {ssoProviders.length > 0 && (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="border-subtle w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="text-subtle bg-default px-2">
                        {t("or_continue_with") || "Or continue with"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {ssoProviders.map((provider) => {
                      const IconComponent = provider.icon;
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => handleSSOSignup(provider.id)}
                          disabled={formState.isSubmitting}
                          className="relative inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          title={`Continue with ${provider.name}`}>
                          <IconComponent />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </form>
        </FormProvider>
      </AuthContainer>
      <AddToHomescreen />
    </div>
  );
}
