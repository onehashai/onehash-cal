import type { IncomingMessage } from "http";
import type { AppContextType, AppInitialProps } from "next/dist/shared/lib/utils";
import GlobalAppProviders from "providers";
// eslint-disable-next-line @calcom/eslint/deprecated-imports-next-router
import React, { useEffect } from "react";

import { trpc } from "@calcom/trpc/react";

import type { AppProps } from "@lib/app-providers";

import "../styles/globals.css";

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

// Wraps MyApp with Global providers
function AppWithProviders(props: AppProps) {
  const content = (
    <GlobalAppProviders>
      <MyApp {...props} />
    </GlobalAppProviders>
  );

  return content;
}

declare global {
  interface Window {
    calNewLocale: string;
  }
}

AppWithProviders.getInitialProps = async (ctx: AppContextType): Promise<AppInitialProps> => {
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

const WrappedMyApp = trpc.withTRPC(AppWithProviders);

export default WrappedMyApp;
