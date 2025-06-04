"use client";

import classNames from "classnames";
import dynamic from "next/dynamic";
import Head from "next/head";
import type { FC } from "react";
import { useEffect, useState } from "react";

import { getSuccessPageLocationMessage } from "@calcom/app-store/locations";
import dayjs from "@calcom/dayjs";
import { sdkActionManager, useIsEmbed } from "@calcom/embed-core/embed-iframe";
import { PayIcon } from "@calcom/features/bookings/components/event-meta/PayIcon";
import { Price } from "@calcom/features/bookings/components/event-meta/Price";
import { APP_NAME, WEBSITE_URL } from "@calcom/lib/constants";
import getPaymentAppData from "@calcom/lib/getPaymentAppData";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import useTheme from "@calcom/lib/hooks/useTheme";
import { getIs24hClockFromLocalStorage, isBrowserLocale24h } from "@calcom/lib/timeFormat";
import { localStorage } from "@calcom/lib/webstorage";

import type { PaymentPageProps } from "../pages/payment";

const StripePaymentComponent = dynamic(() => import("./Payment"), {
  ssr: false,
});

const PaypalPaymentComponent = dynamic(
  () =>
    import("@calcom/app-store/paypal/components/PaypalPaymentComponent").then(
      (m) => m.PaypalPaymentComponent
    ),
  {
    ssr: false,
  }
);

const AlbyPaymentComponent = dynamic(
  () => import("@calcom/app-store/alby/components/AlbyPaymentComponent").then((m) => m.AlbyPaymentComponent),
  {
    ssr: false,
  }
);

const determineClockFormat = (): boolean => isBrowserLocale24h();

const establishTimezone = (): string => {
  const storedTimezone = localStorage.getItem("timeOption.preferredTimeZone");
  const detectedTimezone = dayjs.tz.guess();
  return storedTimezone || detectedTimezone || "Europe/London";
};

const calculateEventDateTime = (startTime: string, targetTimezone: string) => {
  const baseDate = dayjs.utc(startTime);
  return baseDate.tz(targetTimezone);
};

const configureEmbedDimensions = (embedMode: boolean) => {
  if (!embedMode) return;

  let iframeWidth = 0;

  const adjustStripeIframe = () => {
    const stripeWrapper = document.querySelector(
      'iframe[src*="https://js.stripe.com/v3/authorize-with-url-inner"]'
    )?.parentElement;

    if (stripeWrapper) {
      stripeWrapper.style.margin = "0 auto";
      stripeWrapper.style.width = `${iframeWidth}px`;
    }
    requestAnimationFrame(adjustStripeIframe);
  };

  requestAnimationFrame(adjustStripeIframe);

  sdkActionManager?.on("__dimensionChanged", (event) => {
    iframeWidth = event.detail.data.iframeWidth as number;
  });
};

const generatePageTitle = (localization: any, eventTitle: string): string => {
  return `${localization.t("payment")} | ${eventTitle} | ${APP_NAME}`;
};

const createBookingDetailsGrid = (
  props: PaymentPageProps,
  formattedDate: dayjs.Dayjs,
  clockFormat: boolean,
  currentTimezone: string | null,
  localization: any
) => {
  const paymentInfo = getPaymentAppData(props.eventType);

  return (
    <div className="text-default mt-4 grid grid-cols-3 border-b border-t py-4 text-left dark:border-gray-900 dark:text-gray-300">
      <div className="font-medium">{localization.t("what")}</div>
      <div className="col-span-2 mb-6">{props.booking.title}</div>
      <div className="font-medium">{localization.t("when")}</div>
      <div className="col-span-2 mb-6">
        {formattedDate.format("dddd, DD MMMM YYYY")}
        <br />
        {formattedDate.format(clockFormat ? "H:mm" : "h:mma")} - {props.eventType.length} mins{" "}
        <span className="text-subtle">({currentTimezone})</span>
      </div>
      {props.booking.location && (
        <>
          <div className="font-medium">{localization.t("where")}</div>
          <div className="col-span-2 mb-6">
            {getSuccessPageLocationMessage(props.booking.location, localization.t)}
          </div>
        </>
      )}
      <div className="font-medium">
        {props.payment.paymentOption === "HOLD" ? localization.t("no_show_fee") : localization.t("price")}
      </div>
      <div className="col-span-2 mb-6 font-semibold">
        <Price currency={paymentInfo.currency} price={paymentInfo.price} displayAlternateSymbol={false} />
      </div>
    </div>
  );
};

const renderPaymentStatus = (paymentData: any, localization: any) => {
  if (paymentData.success && !paymentData.refunded) {
    return <div className="text-default mt-4 text-center dark:text-gray-300">{localization.t("paid")}</div>;
  }

  if (paymentData.refunded) {
    return (
      <div className="text-default mt-4 text-center dark:text-gray-300">{localization.t("refunded")}</div>
    );
  }

  return null;
};

const renderPaymentComponent = (props: PaymentPageProps) => {
  const { payment: transactionData } = props;

  if (transactionData.success) return null;

  switch (transactionData.appId) {
    case "stripe":
      return (
        <StripePaymentComponent
          clientSecret={props.clientSecret}
          payment={props.payment}
          eventType={props.eventType}
          user={props.user}
          location={props.booking.location}
          booking={props.booking}
        />
      );
    case "paypal":
      return <PaypalPaymentComponent payment={props.payment} />;
    case "alby":
      return <AlbyPaymentComponent payment={props.payment} paymentPageProps={props} />;
    default:
      return null;
  }
};

const renderBrandingSection = (profileSettings: any, localization: any) => {
  if (profileSettings.hideBranding) return null;

  return (
    <div className="text-muted dark:text-inverted mt-4 border-t pt-4 text-center text-xs dark:border-gray-900">
      <a href={`${WEBSITE_URL}/signup`}>
        {localization.t("create_booking_link_with_calcom", { appName: APP_NAME })}
      </a>
    </div>
  );
};

const PaymentPage: FC<PaymentPageProps> = (props) => {
  const localization = useLocale();
  const [clockFormat, setClockFormat] = useState(determineClockFormat());
  const [eventDateTime, setEventDateTime] = useState(dayjs.utc(props.booking.startTime));
  const [currentTimezone, setCurrentTimezone] = useState<string | null>(null);
  const embedMode = useIsEmbed();
  const transactionAppData = getPaymentAppData(props.eventType);

  useTheme(props.profile.theme);

  useEffect(() => {
    const detectedTimezone = establishTimezone();
    const adjustedDateTime = calculateEventDateTime(props.booking.startTime, detectedTimezone);
    const preferredClockFormat = !!getIs24hClockFromLocalStorage();

    setCurrentTimezone(detectedTimezone);
    setEventDateTime(adjustedDateTime);
    setClockFormat(preferredClockFormat);

    configureEmbedDimensions(embedMode || false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedMode]);

  const bookingTitle = props.booking.title;
  const pageTitle = generatePageTitle(localization, bookingTitle);
  const bookingDetailsGrid = createBookingDetailsGrid(
    props,
    eventDateTime,
    clockFormat,
    currentTimezone,
    localization
  );

  return (
    <div className="h-screen">
      <Head>
        <title>{pageTitle}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="mx-auto max-w-3xl py-24">
        <div className="fixed inset-0 z-50 overflow-y-auto scroll-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
            <div className="inset-0 my-4 transition-opacity sm:my-0" aria-hidden="true">
              <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
                &#8203;
              </span>
              <div
                className={classNames(
                  "main bg-default border-subtle inline-block transform overflow-hidden rounded-lg border px-8 pb-4 pt-5 text-left align-bottom transition-all  sm:w-full sm:max-w-lg sm:py-6 sm:align-middle",
                  embedMode ? "" : "sm:my-8"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-headline">
                <div>
                  <div className="bg-success mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                    <PayIcon currency={transactionAppData.currency} className="h-8 w-8 text-green-600" />
                  </div>

                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-emphasis text-2xl font-semibold leading-6" id="modal-headline">
                      {transactionAppData.paymentOption === "HOLD"
                        ? localization.t("complete_your_booking")
                        : localization.t("payment")}
                    </h3>
                    {bookingDetailsGrid}
                  </div>
                </div>
                <div>
                  {renderPaymentStatus(props.payment, localization)}
                  {renderPaymentComponent(props)}
                </div>
                {renderBrandingSection(props.profile, localization)}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentPage;
