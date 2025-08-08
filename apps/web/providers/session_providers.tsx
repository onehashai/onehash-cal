// eslint-disable-next-line no-restricted-imports
import { capitalize } from "lodash";
import { signOut } from "next-auth/react";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

import { getFullNameFromField } from "@calcom/lib/getName";
import { trpc } from "@calcom/trpc";

type UserData = {
  id: number;
  email: string;
  name: string;
  username: string;
  createdAt: string;
  completedOnboarding: boolean;
  customBrandingEnabled: boolean;
  timezone: string;
  email_verified: boolean;
};

// Higher-level component where session state is managed
export default function SessionManager({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<undefined | UserData>(undefined);
  const [analyticsInitialized, setAnalyticsInitialized] = useState(false);
  const checkKeyCloakSession = async () => {
    try {
      const response = await fetch("/api/auth/keycloak/userinfo");
      const data = await response.json();
      //Will logout,if  any of these happen
      //1. keycloak cookie cleared
      //2. keycloak session deleted from DB
      //3. Session expired on KEYCLOAK SSO
      if (
        data.message === "Session expired. Please log in again." ||
        data.message === "Access Token absent. Please log in again." ||
        data.message === "Keycloak Session not found. Please log in again."
      ) {
        await signOut();
        posthog.reset(true);
        return undefined;
      }
      return data.info;
    } catch (error) {
      console.error("There was a problem with the fetch operation:", error);
    }
  };
  const { data: statsData } = trpc.viewer.myStats.useQuery(undefined, {
    trpc: {
      context: {
        skipBatch: true,
      },
    },
    staleTime: 1000 * 60 * 5,
  });

  function getNameFromField(name: string): [string, string] {
    // If it's an email address
    if (name.includes("@")) {
      const username = name.split("@")[0];
      const parts = username.split(/[._\-]+/); // e.g., "john_doe" => ["john", "doe"]
      const words = parts.map((word) => capitalize(word));

      const firstName = words[0] || "";
      const lastName = words.length > 1 ? words.slice(1).join(" ") : "";

      return [firstName, lastName];
    }

    // If it's a proper name already
    const words = name.trim().split(/\s+/); // split by whitespace
    const firstName = words[0] || "";
    const lastName = words.length > 1 ? words.slice(1).join(" ") : "";

    return [firstName, lastName];
  }

  //Checks for session and attaches posthog to current user
  const init = async () => {
    if (!userData) {
      const userInfo: UserData = await checkKeyCloakSession();
      setUserData(userInfo);
    } else {
      if (statsData) {
        if (analyticsInitialized) {
          return; // Analytics already initialized
        }
        const { id, email, name, username, createdAt, completedOnboarding, customBrandingEnabled, timezone } =
          userData;
        const [first_name, last_name] = getFullNameFromField(name);
        const trackingPayload = {
          id,
          email,
          first_name,
          last_name,
          created_at: Math.floor(Date.parse(createdAt) / 1000),
          slug: username,
          onboarding_completed: completedOnboarding,
          custom_branding: customBrandingEnabled,
          lifetime_meetings: statsData.sumOfBookings,
          timezone,
          availability_configured: statsData.availability_configured, //Whether availability settings are configured
          integrations_connected: statsData.integrations_connected, //Object with
          branding_configured: statsData.branding_configured, //Whether custom branding is configured
          workflows_configured: statsData.workflows_configured, //Whether workflows are configured
          setup_items_completed: statsData.setup_items_completed, //Number of setup items completed
          email_verified: userData.email_verified, // Whether the email is verified
        };
        posthog.identify(String(id), trackingPayload);

        // CIO Analytics identification with retry mechanism for delayed loading
        const identifyWithCIO = (retryCount = 0, maxRetries = 10) => {
          if (
            typeof window !== "undefined" &&
            window.cioanalytics &&
            typeof window.cioanalytics.identify === "function"
          ) {
            try {
              window.cioanalytics.identify(id, trackingPayload);
            } catch (error) {
              console.error("Error identifying user with CIO Analytics:", error);
            }
          } else if (retryCount < maxRetries) {
            // Retry with exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
            setTimeout(() => {
              identifyWithCIO(retryCount + 1, maxRetries);
            }, 100 * Math.pow(2, retryCount));
          } else {
            console.warn("CIO Analytics not available after maximum retries");
          }
        };
        identifyWithCIO();
        setAnalyticsInitialized(true);
      }
    }
  };

  useEffect(() => {
    init();
  }, [statsData]);

  return <>{children}</>;
}
