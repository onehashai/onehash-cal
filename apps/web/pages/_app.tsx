import type { IncomingMessage } from "http";
import { signOut } from "next-auth/react";
import type { AppContextType, AppInitialProps } from "next/dist/shared/lib/utils";
// eslint-disable-next-line @calcom/eslint/deprecated-imports-next-router
import { Router } from "next/router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import React, { useEffect } from "react";

import { trpc } from "@calcom/trpc/react";

import type { AppProps } from "@lib/app-providers";

import "../styles/globals.css";

// Higher-level component where session state is managed
function SessionManager({ children }: { children: React.ReactNode }) {
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
      }
    } catch (error) {
      console.error("There was a problem with the fetch operation:", error);
    }
  };
  useEffect(() => {
    checkKeyCloakSession();
  }, []);

  return <>{children}</>;
}

// MyApp component
function MyApp(props: AppProps) {
  const { Component, pageProps } = props;

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js");
    }
  }, []);

  const content = Component.PageWrapper ? <Component.PageWrapper {...props} /> : <Component {...pageProps} />;

  return content;
}

// Wraps MyApp with SessionManager to handle session expiration and integrates PostHog
function AppWithSessionManager(props: AppProps) {
  useEffect(() => {
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
  }, []);

  const content = (
    <SessionManager>
      <MyApp {...props} />
    </SessionManager>
  );

  return <PostHogProvider client={posthog}>{content}</PostHogProvider>;
}

declare global {
  interface Window {
    calNewLocale: string;
  }
}

AppWithSessionManager.getInitialProps = async (ctx: AppContextType): Promise<AppInitialProps> => {
  const { req } = ctx.ctx;

  let newLocale = "en";

  if (req) {
    const { getLocale } = await import("@calcom/features/auth/lib/getLocale");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newLocale = await getLocale(req as IncomingMessage & { cookies: Record<string, any> });
  } else if (typeof window !== "undefined" && window.calNewLocale) {
    newLocale = window.calNewLocale;
  }

  return {
    pageProps: {
      newLocale,
      currentPath: ctx.router.asPath, // Pass the current route
    },
  };
};

const WrappedMyApp = trpc.withTRPC(AppWithSessionManager);

export default WrappedMyApp;
