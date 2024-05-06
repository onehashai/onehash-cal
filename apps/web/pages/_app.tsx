import type { IncomingMessage } from "http";
import { signOut } from "next-auth/react";
import type { AppContextType, AppInitialProps } from "next/dist/shared/lib/utils";
import React, { useEffect } from "react";

import { trpc } from "@calcom/trpc/react";

import type { AppProps } from "@lib/app-providers";

import "../styles/globals.css";

// Higher-level component where session state is managed
function SessionManager({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cachedUserInfo = sessionStorage.getItem("isSessionActive");
    if (cachedUserInfo) {
      return;
    }
    fetch("/api/auth/keycloak/userinfo")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        if (data.message === "Session expired. Please log in again." || data.message === "No Session Info.") {
          signOut();
        } else {
          sessionStorage.setItem("isSessionActive", "true");
        }
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  }, []);

  return <>{children}</>;
}

// MyApp component
function MyApp(props: AppProps) {
  const { Component, pageProps } = props;

  if (Component.PageWrapper !== undefined) return Component.PageWrapper(props);
  return <Component {...pageProps} />;
}

// Wraps MyApp with SessionManager to handle session expiration
function AppWithSessionManager(props: AppProps) {
  return (
    <SessionManager>
      <MyApp {...props} />
    </SessionManager>
  );
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
    },
  };
};

const WrappedMyApp = trpc.withTRPC(AppWithSessionManager);

export default WrappedMyApp;
