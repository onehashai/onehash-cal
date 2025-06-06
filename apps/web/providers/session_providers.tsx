import { signOut } from "next-auth/react";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

import dayjs from "@calcom/dayjs";
import { trpc } from "@calcom/trpc";

// Higher-level component where session state is managed
export default function SessionManager({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState();
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
      const userInfo = await checkKeyCloakSession();
      setUserData(userInfo);
    } else {
      if (statsData) {
        const { id, email, name, username, createdAt, completedOnboarding } = userData;
        const createdAtFormatted = String(dayjs(createdAt).format("DD-MM-YYYY, HH:mm"));
        const posthogPayload = {
          email,
          name,
          userslug: username,
          createdAt: createdAtFormatted,
          completedOnboarding,
          sum_of_bookings: statsData.sumOfBookings,
          sum_of_calendars: statsData.sumOfCalendars,
          sum_of_teams: statsData.sumOfTeams,
          sum_of_event_types: statsData.sumOfEventTypes,
          sum_of_team_event_types: statsData.sumOfTeamEventTypes,
        };
        posthog.identify(id, posthogPayload);
      }
    }
  };

  useEffect(() => {
    init();
  }, [statsData]);

  return <>{children}</>;
}
