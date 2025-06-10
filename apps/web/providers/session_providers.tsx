import { signOut } from "next-auth/react";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

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
};

// Higher-level component where session state is managed
export default function SessionManager({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<undefined | UserData>(undefined);
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
  });

  //Checks for session and attaches posthog to current user
  const init = async () => {
    if (!userData) {
      const userInfo: UserData = await checkKeyCloakSession();
      setUserData(userInfo);
    } else {
      if (statsData) {
        const { id, email, name, username, createdAt, completedOnboarding, customBrandingEnabled, timezone } =
          userData;
        const [first_name, last_name] = name.trim().split(/\s+/);
        const trackingPayload = {
          id,
          email,
          first_name,
          last_name,
          created_at: createdAt,
          slug: username,
          onboarding_completed: completedOnboarding,
          custom_branding: customBrandingEnabled,
          lifetime_meetings: statsData.sumOfBookings,
          timezone,
          // profile_completed: completedOnboarding,
          // availability_configured: statsData.sumOfCalendars > 0, //Whether availability settings are configured
          // sum_of_calendars: statsData.sumOfCalendars,
          // sum_of_teams: statsData.sumOfTeams,
          // sum_of_event_types: statsData.sumOfEventTypes,
          // sum_of_team_event_types: statsData.sumOfTeamEventTypes,

          // plan_type: "N/A", //trial , paid , cancelled
          // plan_tier: "N/A", //trial , pro , team , enterprise , cancelled , basic
          // user_type: "solo", //solo , team , enterprise
          // subscription_status: "N/A", //active , past_due , expired , cancelled"
          // mrr: "N/A", //Revenue generated per month from this customer
          // account_value: "N/A", //Total value of the customer account
          // lifetime_revenue: "N/A", //All-time revenue from this customer
          // tenure_months: "N/A",
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
      }
    }
  };

  useEffect(() => {
    init();
  }, [statsData]);

  return <>{children}</>;
}
