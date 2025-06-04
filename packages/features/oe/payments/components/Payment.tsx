import type { EventType, Payment } from "@prisma/client";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementLocale, StripeElements, StripePaymentElementOptions } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import type { SyntheticEvent } from "react";
import { useEffect, useState } from "react";

import getStripe from "@calcom/app-store/stripepayment/lib/client";
import { useBookingSuccessRedirect } from "@calcom/lib/bookingSuccessRedirect";
import { useCompatSearchParams } from "@calcom/lib/hooks/useCompatSearchParams";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { PaymentOption } from "@calcom/prisma/enums";
import { Button, CheckboxField } from "@calcom/ui";

import type { PaymentPageProps } from "../pages/payment";

export type Props = {
  payment: Omit<Payment, "id" | "fee" | "success" | "refunded" | "externalId" | "data"> & {
    data: Record<string, unknown>;
  };
  eventType: {
    id: number;
    successRedirectUrl: EventType["successRedirectUrl"];
    forwardParamsSuccessRedirect: EventType["forwardParamsSuccessRedirect"];
  };
  user: {
    username: string | null;
  };
  location?: string | null;
  clientSecret: string;
  booking: PaymentPageProps["booking"];
};

export type States =
  | {
      status: "idle";
    }
  | {
      status: "processing";
    }
  | {
      status: "error";
      error: Error;
    }
  | {
      status: "ok";
    };

const buildCheckoutFormControls = (
  transactionOption: PaymentOption | null,
  currentState: States,
  cancelingInProgress: boolean,
  termsAccepted: boolean
) => {
  const isDisabled =
    cancelingInProgress || !termsAccepted || ["processing", "error"].includes(currentState.status);
  return { isDisabled };
};

const createPaymentConfiguration = (): StripePaymentElementOptions =>
  ({
    layout: "accordion",
  } as StripePaymentElementOptions);

const shouldShowHoldNotice = (option: PaymentOption | null): boolean => option === "HOLD";

const determineButtonText = (processingState: string, option: PaymentOption | null, locale: any) => {
  if (processingState === "processing") return <div className="spinner" id="spinner" />;
  return option === "HOLD" ? locale.t("submit_card") : locale.t("pay_now");
};

export const PaymentFormComponent = (
  props: Props & {
    onSubmit: (ev: SyntheticEvent) => void;
    onCancel: () => void;
    onPaymentElementChange: () => void;
    elements: StripeElements | null;
    paymentOption: PaymentOption | null;
    state: States;
  }
) => {
  const locale = useLocale();
  const {
    paymentOption: transactionMode,
    elements: stripeElements,
    state: currentState,
    onPaymentElementChange: elementChangeHandler,
  } = props;
  const [cancelInProgress, setCancelInProgress] = useState<boolean>(false);
  const [holdTermsAccept, setHoldTermsAccept] = useState<boolean>(transactionMode === "HOLD" ? false : true);

  const { isDisabled: buttonsDisabled } = buildCheckoutFormControls(
    transactionMode,
    currentState,
    cancelInProgress,
    holdTermsAccept
  );
  const checkoutConfig = createPaymentConfiguration();

  useEffect(() => {
    stripeElements?.update({ locale: locale.i18n.language as StripeElementLocale });
  }, [stripeElements, locale.i18n.language]);

  const renderHoldAcknowledgment = () => {
    if (!shouldShowHoldNotice(transactionMode)) return null;

    return (
      <div className="bg-info mb-5 mt-2 rounded-md p-3">
        <CheckboxField
          description={locale.t("acknowledge_booking_no_show_fee", {
            amount: props.payment.amount / 100,
            formatParams: { amount: { currency: props.payment.currency } },
          })}
          onChange={(evt) => setHoldTermsAccept(evt.target.checked)}
          descriptionClassName="text-info font-semibold"
        />
      </div>
    );
  };

  const renderErrorDisplay = () => {
    if (currentState.status !== "error") return null;

    return (
      <div className="mt-4 text-center text-red-900 dark:text-gray-300" role="alert">
        {currentState.error.message}
      </div>
    );
  };

  const handleCancelClick = () => {
    setCancelInProgress(true);
    props.onCancel();
  };

  return (
    <form id="payment-form" className="bg-subtle mt-4 rounded-md p-6" onSubmit={props.onSubmit}>
      <div>
        <PaymentElement options={checkoutConfig} onChange={(_) => elementChangeHandler()} />
      </div>
      {renderHoldAcknowledgment()}
      <div className="mt-2 flex justify-end space-x-2">
        <Button
          color="minimal"
          disabled={buttonsDisabled}
          id="cancel"
          type="button"
          loading={cancelInProgress}
          onClick={handleCancelClick}>
          <span id="button-text">{locale.t("cancel")}</span>
        </Button>
        <Button
          type="submit"
          disabled={buttonsDisabled}
          loading={currentState.status === "processing"}
          id="submit"
          color="secondary">
          <span id="button-text">{determineButtonText(currentState.status, transactionMode, locale)}</span>
        </Button>
      </div>
      {renderErrorDisplay()}
    </form>
  );
};

const executeStripePaymentFlow = async (
  stripeInstance: any,
  elementsInstance: any,
  transactionType: PaymentOption | null,
  paymentData: any
) => {
  if (transactionType === "HOLD" && "setupIntent" in paymentData.data) {
    return await stripeInstance.confirmSetup({
      elements: elementsInstance,
      redirect: "if_required",
    });
  }

  if (transactionType === "ON_BOOKING") {
    return await stripeInstance.confirmPayment({
      elements: elementsInstance,
      redirect: "if_required",
    });
  }

  return null;
};

const buildRedirectParameters = (
  bookingData: any,
  searchParams: any,
  payload: any,
  transactionType: PaymentOption | null
) => {
  const baseParams: {
    uid: string;
    email: string | null;
    location?: string;
    payment_intent?: string;
    payment_intent_client_secret?: string;
    redirect_status?: string;
  } = {
    uid: bookingData.uid,
    email: searchParams?.get("email"),
  };

  if (transactionType === "HOLD" && payload.setupIntent) {
    baseParams.payment_intent = payload.setupIntent.id;
    baseParams.payment_intent_client_secret = payload.setupIntent.client_secret || undefined;
    baseParams.redirect_status = payload.setupIntent.status;
  } else if (transactionType === "ON_BOOKING" && payload.paymentIntent) {
    baseParams.payment_intent = payload.paymentIntent.id;
    baseParams.payment_intent_client_secret = payload.paymentIntent.client_secret || undefined;
    baseParams.redirect_status = payload.paymentIntent.status;
  }

  return baseParams;
};

const PaymentForm = (props: Props) => {
  const {
    user: { username: userHandle },
  } = props;
  const localization = useLocale();
  const navigationRouter = useRouter();
  const urlSearchParams = useCompatSearchParams();
  const [processingState, setProcessingState] = useState<States>({ status: "idle" });
  const stripeClient = useStripe();
  const stripeElementsClient = useElements();
  const transactionMethod = props.payment.paymentOption;
  const successRedirectHandler = useBookingSuccessRedirect();

  const processCheckoutSubmission = async (evt: SyntheticEvent) => {
    evt.preventDefault();

    if (!stripeClient || !stripeElementsClient || urlSearchParams === null) {
      return;
    }

    if (!stripeClient || !stripeElementsClient) {
      return;
    }

    setProcessingState({ status: "processing" });

    const stripeResponse = await executeStripePaymentFlow(
      stripeClient,
      stripeElementsClient,
      transactionMethod,
      props.payment
    );

    if (stripeResponse?.error) {
      setProcessingState({
        status: "error",
        error: new Error(`Payment failed: ${stripeResponse.error.message}`),
      });
      return;
    }

    const redirectParams = buildRedirectParameters(
      props.booking,
      urlSearchParams,
      stripeResponse,
      transactionMethod
    );

    if (props.location) {
      if (props.location.includes("integration")) {
        redirectParams.location = localization.t("web_conferencing_details_to_follow");
      } else {
        redirectParams.location = props.location;
      }
    }

    return successRedirectHandler({
      successRedirectUrl: props.eventType.successRedirectUrl,
      query: redirectParams,
      booking: props.booking,
      forwardParamsSuccessRedirect: props.eventType.forwardParamsSuccessRedirect,
    });
  };

  const handleCancellation = () => {
    if (userHandle) {
      return navigationRouter.push(`/${userHandle}`);
    }
    return navigationRouter.back();
  };

  const resetProcessingState = () => {
    setProcessingState({ status: "idle" });
  };

  return (
    <PaymentFormComponent
      {...props}
      elements={stripeElementsClient}
      paymentOption={transactionMethod}
      state={processingState}
      onSubmit={processCheckoutSubmission}
      onCancel={handleCancellation}
      onPaymentElementChange={resetProcessingState}
    />
  );
};

const detectThemePreference = (): "stripe" | "night" => {
  return document.documentElement.classList.contains("dark") ? "night" : "stripe";
};

export default function PaymentComponent(props: Props) {
  const stripeClientPromise = getStripe(props.payment.data.stripe_publishable_key as any);
  const [appearanceTheme, setAppearanceTheme] = useState<"stripe" | "night">("stripe");

  useEffect(() => {
    const detectedTheme = detectThemePreference();
    setAppearanceTheme(detectedTheme);
  }, []);

  return (
    <Elements
      stripe={stripeClientPromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: appearanceTheme,
        },
      }}>
      <PaymentForm {...props} />
    </Elements>
  );
}
