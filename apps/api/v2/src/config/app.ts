import { getEnv } from "@/env";

import type { AppConfig } from "./type";

const loadConfig = (): AppConfig => {
  const isBillingEnabled = process.env.IS_BILLING_ENABLED === "true";
  return {
    env: {
      type: getEnv("NODE_ENV", "development"),
    },
    api: {
      port: Number(getEnv("API_PORT", "5555")),
      path: getEnv("API_URL", "http://localhost"),
      url: `${getEnv("API_URL", "http://localhost")}${
        process.env.API_PORT && getEnv("NODE_ENV", "development") === "development"
          ? `:${Number(getEnv("API_PORT", "5555"))}`
          : ""
      }/v2`,
      apiKeyPrefix: getEnv("API_KEY_PREFIX", "cal_"),
      licenseKey: isBillingEnabled ? getEnv("CALCOM_LICENSE_KEY", "") : "",
      licenseKeyUrl: isBillingEnabled
        ? getEnv("GET_LICENSE_KEY_URL", "https://console.cal.com/api/license")
        : "",
    },
    db: {
      readUrl: getEnv("DATABASE_READ_URL"),
      writeUrl: getEnv("DATABASE_WRITE_URL"),
      redisUrl: getEnv("REDIS_URL"),
    },
    next: {
      authSecret: getEnv("NEXTAUTH_SECRET"),
    },
    stripe: {
      apiKey: isBillingEnabled ? getEnv("STRIPE_API_KEY") : "",
      webhookSecret: isBillingEnabled ? getEnv("STRIPE_WEBHOOK_SECRET") : "",
    },
    app: {
      baseUrl: getEnv("WEB_APP_URL", "https://app.cal.com"),
    },
    e2e: getEnv("IS_E2E", false),
    isBillingEnabled: isBillingEnabled,
  };
};

export default loadConfig;
