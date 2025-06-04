import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var stripe: Stripe | undefined;
}

const createStripeInstance = (): Stripe => {
  const apiKey = process.env.STRIPE_PRIVATE_KEY!;
  const config = {
    apiVersion: "2020-08-27" as const,
  };
  return new Stripe(apiKey, config);
};

const getStripeClient = (): Stripe => {
  if (globalThis.stripe) {
    return globalThis.stripe;
  }
  return createStripeInstance();
};

const stripeClient = getStripeClient();

const isDevelopment = process.env.NODE_ENV !== "production";
if (isDevelopment) {
  globalThis.stripe = stripeClient;
}

export default stripeClient;
