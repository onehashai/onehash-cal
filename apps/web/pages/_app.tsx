import type { IncomingMessage } from "http";
import { signOut } from "next-auth/react";
import type { AppContextType, AppInitialProps } from "next/dist/shared/lib/utils";
import React, { useEffect } from "react";

import { trpc } from "@calcom/trpc/react";

import type { AppProps } from "@lib/app-providers";

import "../styles/globals.css";

type AppOwnProps = { sessionExpired: boolean };

// Higher-level component where session state is managed
function SessionManager({
  children,
  sessionExpired,
}: {
  children: React.ReactNode;
  sessionExpired: boolean;
}) {
  useEffect(() => {
    if (sessionExpired) {
      signOut();
    }
  }, [sessionExpired]);

  return <>{children}</>;
}

// MyApp component
function MyApp(props: AppProps & AppOwnProps) {
  const { Component, pageProps } = props;

  if (Component.PageWrapper !== undefined) return Component.PageWrapper(props);
  return <Component {...pageProps} />;
}

// Wraps MyApp with SessionManager to handle session expiration
function AppWithSessionManager(props: AppProps & AppOwnProps) {
  return (
    <SessionManager sessionExpired={props.sessionExpired}>
      <MyApp {...props} />
    </SessionManager>
  );
}

declare global {
  interface Window {
    calNewLocale: string;
  }
}

AppWithSessionManager.getInitialProps = async (
  ctx: AppContextType
): Promise<AppOwnProps & AppInitialProps> => {
  const { req } = ctx.ctx;

  let newLocale = "en";

  if (req) {
    const { getLocale } = await import("@calcom/features/auth/lib/getLocale");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newLocale = await getLocale(req as IncomingMessage & { cookies: Record<string, any> });
  } else if (typeof window !== "undefined" && window.calNewLocale) {
    newLocale = window.calNewLocale;
  }
  let sessionExpired = false;
  try {
    const response = await fetch("api/auth/keycloak/userinfo");

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    if (data.message === "Session expired. Please log in again.") {
      sessionExpired = true;
    }
  } catch (error) {
    sessionExpired = true;
    console.error("There was a problem with the fetch operation:", error);
  }

  return {
    pageProps: {
      newLocale,
    },
    sessionExpired,
  };
};

const WrappedMyApp = trpc.withTRPC(AppWithSessionManager);

export default WrappedMyApp;
