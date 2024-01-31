import type { NextApiRequest, NextApiResponse } from "next";

import { WEBAPP_URL } from "@calcom/lib/constants";
import { getSafeRedirectUrl } from "@calcom/lib/getSafeRedirectUrl";

import { getStripeCustomerIdFromUserId } from "../lib/customer";
import stripe from "../lib/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  // if (!referer) return res.status(400).json({ message: "Missing referrer" });

  if (!req.session?.user?.id) return res.status(401).json({ message: "Not authenticated" });

  // If accessing a user's portal
  const customerId = await getStripeCustomerIdFromUserId(req.session.user.id);
  if (!customerId) return res.status(400).json({ message: "CustomerId not found in stripe" });

  let return_url = `${WEBAPP_URL}/settings/billing`;

  if (typeof req.query.returnTo === "string") {
    const safeRedirectUrl = getSafeRedirectUrl(req.query.returnTo);
    if (safeRedirectUrl) return_url = safeRedirectUrl;
  }

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "OneHash, Inc. partners with Stripe for simplified billing",
    },
    features: {
      subscription_update: {
        default_allowed_updates: ["price", "promotion_code", "quantity"],
        enabled: true,
        proration_behavior: "always_invoice",
        products: [
          {
            product: process.env.STRIPE_TEAM_PRODUCT_ID as string,
            prices: [process.env.STRIPE_TEAM_MONTHLY_PRICE_ID as string],
          },
        ],
      },
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "address"],
      },
      payment_method_update: {
        enabled: true,
      },
      subscription_cancel: {
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
        },
        enabled: true,
        mode: "at_period_end",
      },
      subscription_pause: {
        enabled: false,
      },
      invoice_history: {
        enabled: true,
      },
    },
  });

  const stripeSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url,
    configuration: configuration.id,
  });

  res.redirect(302, stripeSession.url);
}
