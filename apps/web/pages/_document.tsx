/* eslint-disable react/no-danger */
import type { IncomingMessage } from "http";
import { dir } from "i18next";
import type { NextPageContext } from "next";
import type { DocumentContext, DocumentProps } from "next/document";
import Document, { Head, Html, Main, NextScript } from "next/document";
import Script from "next/script";
import { z } from "zod";

import { IS_PRODUCTION } from "@calcom/lib/constants";

import { csp } from "@lib/csp";

type Props = Record<string, unknown> & DocumentProps & { newLocale: string; currentPath: string };
function setHeader(ctx: NextPageContext, name: string, value: string) {
  try {
    ctx.res?.setHeader(name, value);
  } catch (e) {
    // Getting "Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client" when revalidate calendar chache
    console.log(`Error setting header ${name}=${value} for ${ctx.asPath || "unknown asPath"}`, e);
  }
}
class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const { nonce } = csp(ctx.req || null, ctx.res || null);
    if (!process.env.CSP_POLICY) {
      setHeader(ctx, "x-csp", "not-opted-in");
    } else if (!ctx.res?.getHeader("x-csp")) {
      // If x-csp not set by gSSP, then it's initialPropsOnly
      setHeader(ctx, "x-csp", "initialPropsOnly");
    }

    const getLocaleModule = ctx.req ? await import("@calcom/features/auth/lib/getLocale") : null;

    const newLocale =
      ctx.req && getLocaleModule
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await getLocaleModule.getLocale(ctx.req as IncomingMessage & { cookies: Record<string, any> })
        : "en";

    const asPath = ctx.asPath || "";
    // Use a dummy URL as default so that URL parsing works for relative URLs as well. We care about searchParams and pathname only
    const parsedUrl = new URL(asPath, "https://dummyurl");
    const isEmbedSnippetGeneratorPath = parsedUrl.pathname.startsWith("/event-types");
    // FIXME: Revisit this logic to remove embedType query param check completely. Ideally, /embed should always be there at the end of the URL. Test properly and then remove it.
    const isEmbed =
      (parsedUrl.pathname.endsWith("/embed") || parsedUrl.searchParams.get("embedType") !== null) &&
      !isEmbedSnippetGeneratorPath;
    const embedColorScheme = parsedUrl.searchParams.get("ui.color-scheme");
    const initialProps = await Document.getInitialProps(ctx);
    return { isEmbed, embedColorScheme, nonce, ...initialProps, newLocale };
  }

  render() {
    const { isEmbed, embedColorScheme } = this.props;
    const newLocale = this.props.newLocale || "en";
    const newDir = dir(newLocale);

    const nonceParsed = z.string().safeParse(this.props.nonce);
    const nonce = nonceParsed.success ? nonceParsed.data : "";
    const currentPath = this.props.__NEXT_DATA__.props.pageProps.currentPath;

    //allowed analytics paths
    const allowedAnalyticsPaths = [
      "/apps",
      "/auth",
      "/availability",
      // "/booking",
      "/bookings",
      "/event-types",
      "/getting-started",
      // "/reschedule",
      "/settings",
      "/team",
      "/teams",
      "/workflows",
    ];

    const allowScript =
      currentPath === "/" || allowedAnalyticsPaths.some((path) => currentPath.startsWith(path));

    return (
      <Html
        lang={newLocale}
        dir={newDir}
        style={embedColorScheme ? { colorScheme: embedColorScheme as string } : undefined}>
        <Head nonce={nonce}>
          <script
            nonce={nonce}
            id="newLocale"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `
              window.calNewLocale = "${newLocale}";
              (function applyTheme() {
                try {
                  const appTheme = localStorage.getItem('app-theme');
                  if (!appTheme) return;

                  let bookingTheme, username;
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('booking-theme:')) {
                      bookingTheme = localStorage.getItem(key);
                      username = key.split("booking-theme:")[1];
                      break;
                    }
                  }

                  const onReady = () => {
                    const isBookingPage = username && window.location.pathname.slice(1).startsWith(username);

                    if (document.body) {
                      document.body.classList.add(isBookingPage ? bookingTheme : appTheme);
                    } else {
                      requestAnimationFrame(onReady);
                    }
                  };

                  requestAnimationFrame(onReady);
                } catch (e) {
                  console.error('Error applying theme:', e);
                }
              })();
            `,
            }}
          />

          {/* Microsoft Clarity Script */}
          {/* <script
            id="microsoft-clarity-init"
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_MICROSOFT_CLARITY}");
                `,
            }}
          /> */}
          {/* Facebook Pixel Script */}
          {/* <script
            id="pixel"
            dangerouslySetInnerHTML={{
              __html: `
                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script',
                  'https://connect.facebook.net/en_US/fbevents.js');
                  fbq('init', '${process.env.NEXT_PUBLIC_PIXEL}');
                  fbq('track', 'PageView');
                `,
            }}
          /> */}
          <link rel="apple-touch-icon" sizes="180x180" href="/api/logo?type=apple-touch-icon" />
          <link rel="icon" type="image/png" sizes="32x32" href="/api/logo?type=favicon-32" />
          <link rel="icon" type="image/png" sizes="16x16" href="/api/logo?type=favicon-16" />
          <link rel="manifest" href="/site.webmanifest" />
          <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
          <meta name="msapplication-TileColor" content="#ff0000" />
          <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F9FAFC" />
          <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1F1F1F" />
          {!IS_PRODUCTION && process.env.VERCEL_ENV === "preview" && (
            // eslint-disable-next-line @next/next/no-sync-scripts
            <script
              data-project-id="KjpMrKTnXquJVKfeqmjdTffVPf1a6Unw2LZ58iE4"
              src="https://snippet.meticulous.ai/v1/stagingMeticulousSnippet.js"
            />
          )}

          {allowScript && (
            <Script
              src="https://cdn.amplitude.com/script/ca8f70a47b97a98998c9b476e4977212.js"
              strategy="beforeInteractive"
            />
          )}
          {allowScript && (
            <Script
              src="https://cdn.amplitude.com/script/ca8f70a47b97a98998c9b476e4977212.js"
              strategy="afterInteractive"
              onLoad={() => {
                if (window.amplitude && window.amplitude.init) {
                  const plugin = window.sessionReplay?.plugin({ sampleRate: 1 });
                  if (plugin) {
                    window.amplitude.add(plugin);
                  }
                  window.amplitude.init("ca8f70a47b97a98998c9b476e4977212", {
                    fetchRemoteConfig: true,
                    autocapture: true,
                  });
                  console.log("Amplitude plugin loaded");
                } else {
                  console.error("Amplitude failed to initialize.");
                }
              }}
            />
          )}
          {allowScript && (
            <Script
              strategy="afterInteractive"
              src="https://www.googletagmanager.com/gtag/js?id=AW-613079827"
              async
            />
          )}

          {allowScript && (
            <Script
              id="gtm"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
          (function(w,d,s,l,i){
            w[l]=w[l]||[];
            w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
            var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),
            dl=l!='dataLayer'?'&l='+l:'';
            j.async=true;
            j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
            f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-KNB8Q7R4');
        `,
              }}
            />
          )}
        </Head>

        <body
          className="dark:bg-darkgray-50 bg-subtle antialiased"
          style={
            isEmbed
              ? {
                  background: "transparent",
                  // Keep the embed hidden till parent initializes and
                  // - gives it the appropriate styles if UI instruction is there.
                  // - gives iframe the appropriate height(equal to document height) which can only be known after loading the page once in browser.
                  // - Tells iframe which mode it should be in (dark/light) - if there is a a UI instruction for that
                  visibility: "hidden",
                }
              : {}
          }>
          {allowScript && (
            <noscript>
              <iframe
                src="https://www.googletagmanager.com/ns.html?id=GTM-KNB8Q7R4"
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
              />
            </noscript>
          )}
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
