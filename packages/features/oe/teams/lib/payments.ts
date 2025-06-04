import type Stripe from "stripe";
import { z } from "zod";

import { getStripeCustomerIdFromUserId } from "@calcom/app-store/stripepayment/lib/customer";
import stripe from "@calcom/app-store/stripepayment/lib/server";
import {
  IS_PRODUCTION,
  MINIMUM_NUMBER_OF_ORG_SEATS,
  ORGANIZATION_SELF_SERVE_MIN_SEATS,
  ORGANIZATION_SELF_SERVE_PRICE,
  WEBAPP_URL,
} from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import { BillingPeriod } from "@calcom/prisma/zod-utils";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";

const loggerInstance = logger.getSubLogger({ prefix: ["teams/lib/payments"] });

const organizationPaymentDataSchema = z.object({
  paymentId: z.string(),
  subscriptionId: z.string(),
  subscriptionItemId: z.string(),
  orgSeats: teamMetadataSchema.unwrap().shape.orgSeats,
});

export const verifyOrganizationPaymentStatus = async ({ teamId = -1 }) => {
  const organizationRecord = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { metadata: true },
  });

  const parsedMetadata = teamMetadataSchema.parse(organizationRecord.metadata);

  if (!parsedMetadata?.paymentId) return { url: null };

  const sessionData = await stripe.checkout.sessions.retrieve(parsedMetadata.paymentId);

  if (sessionData.payment_status !== "paid") return { url: null };

  return { url: `${WEBAPP_URL}/api/teams/${teamId}/upgrade?session_id=${parsedMetadata.paymentId}` };
};

export const createOrganizationPaymentSession = async ({
  teamName,
  teamSlug,
  userId,
}: {
  teamName: string;
  teamSlug: string;
  userId: number;
}) => {
  const stripeCustomerId = await getStripeCustomerIdFromUserId(userId);

  const paymentSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    allow_promotion_codes: true,
    success_url: `${WEBAPP_URL}/api/teams/create?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEBAPP_URL}/settings/my-account/profile`,
    line_items: [
      {
        price: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
        quantity: 1,
      },
    ],
    customer_update: {
      address: "auto",
    },
    automatic_tax: {
      enabled: IS_PRODUCTION,
    },
    subscription_data: {
      trial_period_days: 14,
    },
    metadata: {
      teamName,
      teamSlug,
      userId,
      dubCustomerId: userId,
    },
  });

  return paymentSession;
};

export const purchaseTeamOrOrgSubscription = async (inputData: {
  teamId: number;
  seatsUsed: number;
  seatsToChargeFor?: number | null;
  userId: number;
  isOrg?: boolean;
  pricePerSeat: number | null;
  billingPeriod?: BillingPeriod;
}) => {
  const {
    teamId,
    seatsToChargeFor,
    seatsUsed,
    userId,
    isOrg,
    pricePerSeat,
    billingPeriod = BillingPeriod.MONTHLY,
  } = inputData;

  const { url } = await verifyOrganizationPaymentStatus({ teamId });
  if (url) return { url };

  const calculatedSeats = isOrg ? Math.max(seatsUsed, MINIMUM_NUMBER_OF_ORG_SEATS) : seatsUsed;
  const finalQuantity = seatsToChargeFor ? seatsToChargeFor : calculatedSeats;

  const customerId = await getStripeCustomerIdFromUserId(userId);
  const basePriceId = await determineBasePriceId(isOrg);

  let finalPriceId: string | undefined;

  if (pricePerSeat) {
    if (
      isOrg &&
      pricePerSeat === ORGANIZATION_SELF_SERVE_PRICE &&
      calculatedSeats === ORGANIZATION_SELF_SERVE_MIN_SEATS
    ) {
      finalPriceId = basePriceId;
    } else {
      const basePriceData = await retrievePriceData(basePriceId);
      finalPriceId = await buildCustomPrice({
        isOrg: !!isOrg,
        teamId,
        pricePerSeat,
        billingPeriod,
        product: basePriceData.product as string,
        currency: basePriceData.currency,
      });
    }
  } else {
    finalPriceId = basePriceId;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    allow_promotion_codes: true,
    success_url: `${WEBAPP_URL}/api/teams/${teamId}/upgrade?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEBAPP_URL}/settings/my-account/profile`,
    line_items: [
      {
        price: finalPriceId,
        quantity: finalQuantity,
      },
    ],
    customer_update: {
      address: "auto",
    },
    automatic_tax: {
      enabled: IS_PRODUCTION,
    },
    metadata: {
      teamId,
    },
    subscription_data: {
      metadata: {
        teamId,
        dubCustomerId: userId,
      },
    },
  });

  return { url: checkoutSession.url };
};

const buildCustomPrice = async ({
  isOrg,
  teamId,
  pricePerSeat,
  billingPeriod,
  product,
  currency,
}: {
  isOrg: boolean;
  teamId: number;
  pricePerSeat: number;
  billingPeriod: BillingPeriod;
  product: Stripe.Product | string;
  currency: string;
}) => {
  try {
    const amountInCents = pricePerSeat * 100;
    const intervalMultiplier = billingPeriod === "MONTHLY" ? 1 : 12;
    const finalAmount = amountInCents * intervalMultiplier;

    const customPriceData = await stripe.prices.create({
      nickname: `Custom price for ${isOrg ? "Organization" : "Team"} ID: ${teamId}`,
      unit_amount: finalAmount,
      currency: currency,
      recurring: { interval: billingPeriod === "MONTHLY" ? "month" : "year" },
      product: typeof product === "string" ? product : product.id,
      tax_behavior: "exclusive",
    });

    return customPriceData.id;
  } catch (error) {
    loggerInstance.error(
      `Error creating custom price for ${isOrg ? "Organization" : "Team"} ID: ${teamId}`,
      safeStringify(error)
    );
    throw new Error("Error in creation of custom price");
  }
};

const determineBasePriceId = async (isOrganization?: boolean) => {
  const environmentPriceId = isOrganization
    ? process.env.STRIPE_ORG_MONTHLY_PRICE_ID
    : process.env.STRIPE_TEAM_MONTHLY_PRICE_ID;

  if (!environmentPriceId) {
    throw new Error(
      "You need to have STRIPE_ORG_MONTHLY_PRICE_ID and STRIPE_TEAM_MONTHLY_PRICE_ID env variables set"
    );
  }

  loggerInstance.debug(
    "Getting price ID",
    safeStringify({
      fixedPriceId: environmentPriceId,
      isOrg: isOrganization,
    })
  );

  return environmentPriceId;
};

const retrievePriceData = async (priceIdentifier: string) => {
  const priceInformation = await stripe.prices.retrieve(priceIdentifier);
  if (!priceInformation) throw new Error(`No price found for ID ${priceIdentifier}`);
  return priceInformation;
};

export const getTeamWithPaymentMetadata = async (organizationId: number) => {
  const organizationData = await prisma.team.findUniqueOrThrow({
    where: { id: organizationId },
    select: { metadata: true, members: true, isOrganization: true },
  });

  const validatedMetadata = organizationPaymentDataSchema.parse(organizationData.metadata);
  return { ...organizationData, metadata: validatedMetadata };
};

export const updateQuantitySubscriptionFromStripe = async (organizationId: number) => {
  try {
    const { url } = await verifyOrganizationPaymentStatus({ teamId: organizationId });

    if (!url) return;

    const organizationDetails = await getTeamWithPaymentMetadata(organizationId);
    const { subscriptionId, subscriptionItemId, orgSeats } = organizationDetails.metadata;

    const minimumRequiredSeats = orgSeats || MINIMUM_NUMBER_OF_ORG_SEATS;
    const currentMemberCount = organizationDetails.members.length;

    const subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
    const currentSubscriptionQuantity = subscriptionDetails.items.data.find(
      (item) => item.id === subscriptionItemId
    )?.quantity;

    if (!currentSubscriptionQuantity) throw new Error("Subscription not found");

    if (organizationDetails.isOrganization && currentMemberCount < minimumRequiredSeats) {
      console.info(
        `Org ${organizationId} has less members than the min required ${minimumRequiredSeats}, skipping updating subscription.`
      );
      return;
    }

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ quantity: currentMemberCount, id: subscriptionItemId }],
    });

    console.info(
      `Updated subscription ${subscriptionId} for team ${organizationId} to ${organizationDetails.members.length} seats.`
    );
  } catch (error) {
    let errorMessage = "Unknown error on updateQuantitySubscriptionFromStripe";
    if (error instanceof Error) errorMessage = error.message;
    console.error(errorMessage);
  }
};
