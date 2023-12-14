//On merge conflict always use the present changes
import { z } from "zod";

import { getStripeCustomerIdFromUserId } from "@calcom/app-store/stripepayment/lib/customer";
import stripe from "@calcom/app-store/stripepayment/lib/server";
import { WEBAPP_URL } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

// const teamPaymentMetadataSchema = z.object({
//   paymentId: z.string(),
//   subscriptionId: z.string(),
//   subscriptionItemId: z.string(),
// });

const userPaymentMetadataSchema = z.object({
  paymentId: z.string(),
  subscriptionId: z.string(),
  subscriptionItemId: z.string(),
});

/** Used to prevent double charges for the same team */
// export const checkIfTeamPaymentRequired = async ({ teamId = -1 }) => {
//   const team = await prisma.team.findUniqueOrThrow({
//     where: { id: teamId },
//     select: { metadata: true },
//   });
//   const metadata = teamMetadataSchema.parse(team.metadata);
//   /** If there's no paymentId, we need to pay this team */
//   if (!metadata?.paymentId) return { url: null };
//   const checkoutSession = await stripe.checkout.sessions.retrieve(metadata.paymentId);
//   /** If there's a pending session but it isn't paid, we need to pay this team */
//   if (checkoutSession.payment_status !== "paid") return { url: null };
//   /** If the session is already paid we return the upgrade URL so team is updated. */
//   return { url: `${WEBAPP_URL}/api/teams/${teamId}/upgrade?session_id=${metadata.paymentId}` };
// };

// export const purchaseTeamSubscription = async (input: {
//   teamId: number;
//   seats: number;
//   userId: number;
//   isOrg?: boolean;
// }) => {
//   const { teamId, seats, userId, isOrg } = input;
//   const { url } = await checkIfTeamPaymentRequired({ teamId });
//   if (url) return { url };
//   // For orgs, enforce minimum of 30 seats
//   const quantity = seats;
//   const customer = await getStripeCustomerIdFromUserId(userId);
//   const session = await stripe.checkout.sessions.create({
//     customer,
//     mode: "subscription",
//     allow_promotion_codes: true,
//     success_url: `${WEBAPP_URL}/api/user/${userId}/upgrade?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${WEBAPP_URL}/settings/my-account/profile`,
//     line_items: [
//       {
//         /** We only need to set the base price and we can upsell it directly on Stripe's checkout  */
//         price: isOrg ? process.env.STRIPE_ORG_MONTHLY_PRICE_ID : process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
//         quantity: quantity,
//       },
//     ],
//     customer_update: {
//       address: "auto",
//     },
//     automatic_tax: {
//       enabled: false,
//     },
//     metadata: {
//       teamId,
//     },
//     subscription_data: {
//       metadata: {
//         teamId,
//       },
//     },
//   });
//   return { url: session.url };
// };

export const purchaseTrialSubscription = async (input: {
  seats: number;
  userId: number;
  isOrg?: boolean;
}) => {
  const { seats, userId, isOrg } = input;
  const quantity = seats;
  const customer = await getStripeCustomerIdFromUserId(userId);
  const session = await stripe.checkout.sessions.create({
    customer,
    mode: "subscription",
    allow_promotion_codes: true,
    success_url: `${WEBAPP_URL}/api/user/${userId}/upgrade?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEBAPP_URL}/settings/my-account/profile`,
    line_items: [
      {
        /** We only need to set the base price and we can upsell it directly on Stripe's checkout  */
        price: isOrg ? process.env.STRIPE_ORG_MONTHLY_PRICE_ID : process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
        quantity: quantity,
      },
    ],
    customer_update: {
      address: "auto",
    },
    automatic_tax: {
      enabled: false,
    },
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
      trial_period_days: 14,
      trial_settings: {
        end_behavior: {
          missing_payment_method: "pause",
        },
      },
    },
    payment_method_collection: "if_required",
  });

  return { url: session.url };
};

export const purchasePaidSubscription = async (input: { seats: number; userId: number; isOrg?: boolean }) => {
  const { seats, userId, isOrg } = input;
  const quantity = seats;
  const customer = await getStripeCustomerIdFromUserId(userId);
  const session = await stripe.checkout.sessions.create({
    customer,
    mode: "subscription",
    allow_promotion_codes: true,
    success_url: `${WEBAPP_URL}/api/user/${userId}/upgrade?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEBAPP_URL}/settings/my-account/profile`,
    line_items: [
      {
        /** We only need to set the base price and we can upsell it directly on Stripe's checkout  */
        price: isOrg ? process.env.STRIPE_ORG_MONTHLY_PRICE_ID : process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
        quantity: quantity,
      },
    ],
    customer_update: {
      address: "auto",
    },
    automatic_tax: {
      enabled: false,
    },
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return { url: session.url };
};
// const getTeamWithPaymentMetadata = async (teamId: number) => {
//   const team = await prisma.team.findUniqueOrThrow({
//     where: { id: teamId },
//     select: { metadata: true, members: true, _count: { select: { orgUsers: true } } },
//   });
//   const metadata = teamPaymentMetadataSchema.parse(team.metadata);
//   return { ...team, metadata };
// };

const getUserWithPaymentMetadata = async (userId: number) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { metadata: true },
  });
  const metadata = userPaymentMetadataSchema.parse(user.metadata);
  return { ...user, metadata };
};

// export const cancelTeamSubscriptionFromStripe = async (teamId: number) => {
//   try {
//     const team = await getTeamWithPaymentMetadata(teamId);
//     const { subscriptionId } = team.metadata;
//     return await stripe.subscriptions.cancel(subscriptionId);
//   } catch (error) {
//     let message = "Unknown error on cancelTeamSubscriptionFromStripe";
//     if (error instanceof Error) message = error.message;
//     console.error(message);
//   }
// };

// export const updateQuantitySubscriptionFromStripe = async (teamId: number) => {
//   try {
//     const { url } = await checkIfTeamPaymentRequired({ teamId });
//     /**
//      * If there's no pending checkout URL it means that this team has not been paid.
//      * We cannot update the subscription yet, this will be handled on publish/checkout.
//      **/
//     if (!url) return;
//     const team = await getTeamWithPaymentMetadata(teamId);
//     const { subscriptionId, subscriptionItemId } = team.metadata;
//     const membershipCount = team.members.length;
//     const subscription = await stripe.subscriptions.retrieve(subscriptionId);
//     const subscriptionQuantity = subscription.items.data.find(
//       (sub) => sub.id === subscriptionItemId
//     )?.quantity;
//     if (!subscriptionQuantity) throw new Error("Subscription not found");

//     if (!!team._count.orgUsers && membershipCount < ORGANIZATION_MIN_SEATS) {
//       console.info(
//         `Org ${teamId} has less members than the min ${ORGANIZATION_MIN_SEATS}, skipping updating subscription.`
//       );
//       return;
//     }

//     await stripe.subscriptions.update(subscriptionId, {
//       items: [{ quantity: membershipCount, id: subscriptionItemId }],
//     });
//     console.info(
//       `Updated subscription ${subscriptionId} for team ${teamId} to ${team.members.length} seats.`
//     );
//   } catch (error) {
//     let message = "Unknown error on updateQuantitySubscriptionFromStripe";
//     if (error instanceof Error) message = error.message;
//     console.error(message);
//   }
// };

export const updateTrialSubscription = async (userId: number, seats: number) => {
  try {
    const user = await getUserWithPaymentMetadata(userId);
    const { subscriptionId, subscriptionItemId } = user.metadata;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionQuantity = subscription.items.data.find(
      (sub) => sub.id === subscriptionItemId
    )?.quantity;
    if (!subscriptionQuantity) throw new Error("Subscription not found");

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ quantity: seats, id: subscriptionItemId }],
    });
    console.info(`Updated subscription ${subscriptionId} for user ${userId} to ${seats} new seats.`);
  } catch (error) {
    let message = "Unknown error on updateTrialSubscription";
    if (error instanceof Error) message = error.message;
    console.error(message);
  }
};

export const updatePaidSubscription = async (userId: number, seats: number) => {
  try {
    const user = await getUserWithPaymentMetadata(userId);
    const { subscriptionId, subscriptionItemId } = user.metadata;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionQuantity = subscription.items.data.find(
      (sub) => sub.id === subscriptionItemId
    )?.quantity;
    if (!subscriptionQuantity) throw new Error("Subscription not found");

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ quantity: seats, id: subscriptionItemId }],
    });
    console.info(`Updated subscription ${subscriptionId} for user ${userId} to ${seats} new seats.`);
  } catch (error) {
    let message = "Unknown error on updateTrialSubscription";
    if (error instanceof Error) message = error.message;
    console.error(message);
  }
};

export const getSubscriptionQuatity = async (userId: number) => {
  const user = await getUserWithPaymentMetadata(userId);
  const { subscriptionId, subscriptionItemId } = user.metadata;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionQuantity = subscription.items.data.find((sub) => sub.id === subscriptionItemId)?.quantity;
  if (!subscriptionQuantity) {
    throw new Error("Subscription not found");
  } else {
    return subscriptionQuantity;
  }
};
