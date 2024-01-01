//On merge conflict always use the present changes
import { z } from "zod";

import { createStripeCustomerIdFromUserId } from "@calcom/app-store/stripepayment/lib/customer";
import stripe from "@calcom/app-store/stripepayment/lib/server";
import { WEBAPP_URL } from "@calcom/lib/constants";
import prisma from "@calcom/prisma";

const userPaymentMetadataSchema = z.object({
  paymentId: z.string(),
  subscriptionId: z.string(),
  subscriptionItemId: z.string(),
});

export const startTrialCheckoutSession = async ({
  teamSlug,
  teamName,
  userId,
}: {
  teamSlug: string;
  teamName: string;
  userId: number;
}) => {
  const customer = await createStripeCustomerIdFromUserId(userId);
  const session = await stripe.checkout.sessions.create({
    customer,
    mode: "subscription",
    allow_promotion_codes: true,
    success_url: `${WEBAPP_URL}/api/user/${userId}/create?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${WEBAPP_URL}/settings/my-account/profile`,
    line_items: [
      {
        /** We only need to set the base price and we can upsell it directly on Stripe's checkout  */
        price: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
        /**Initially it will be just the team owner */
        quantity: 1,
      },
    ],
    customer_update: {
      address: "auto",
    },
    automatic_tax: {
      enabled: false,
    },
    metadata: {
      teamSlug,
      teamName,
      userId,
    },
    subscription_data: {
      trial_settings: {
        end_behavior: {
          missing_payment_method: "pause",
        },
      },
      trial_period_days: 14,
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
    console.info(`Updated subscription ${subscriptionId} for user ${userId} to ${seats} licenses.`);
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
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
    });
    console.info(`Updated subscription ${subscriptionId} for user ${userId} to ${seats} licenses.`);
  } catch (error) {
    let message = "Unknown error on updatePaidSubscription";
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
