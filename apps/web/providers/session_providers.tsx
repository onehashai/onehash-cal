import { signOut } from "next-auth/react";
import posthog from "posthog-js";
import { useEffect } from "react";

// Higher-level component where session state is managed
export default function SessionManager({ children }: { children: React.ReactNode }) {
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

  //Checks for session and attaches posthog to current user
  const init = async () => {
    const userInfo = await checkKeyCloakSession();
    if (userInfo) {
      const { id, email, name, username, createdAt, completedOnboarding } = userInfo;
      console.log("in_here_identify", userInfo);
      posthog.identify(id, {
        email,
        name,
        username,
        createdAt,
        completedOnboarding,
      });
    }
  };

  useEffect(() => {
    init();
  }, []);

  return <>{children}</>;
}
