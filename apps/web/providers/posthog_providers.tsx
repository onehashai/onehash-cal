// eslint-disable-next-line @calcom/eslint/deprecated-imports-next-router
import { Router } from "next/router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";

// PostHog initialization and wrapper component
export default function PostHogWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
        ui_host: "https://us.posthog.com",
        capture_exceptions: true,
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.debug();
        },
        debug: process.env.NODE_ENV === "development",
      });

      const handleRouteChange = () => {
        posthog.capture("$pageview");
      };
      Router.events.on("routeChangeComplete", handleRouteChange);

      return () => {
        Router.events.off("routeChangeComplete", handleRouteChange);
      };
    }
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
