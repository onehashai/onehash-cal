//On merge conflict always use the present changes
import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { z } from "zod";

import stripe from "@calcom/features/ee/payments/server/stripe";
import { HttpError } from "@calcom/lib/http-error";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import prisma from "@calcom/prisma";
import { MembershipRole } from "@calcom/prisma/enums";
import { userMetadata } from "@calcom/prisma/zod-utils";

const querySchema = z.object({
  user: z.string().transform((val) => parseInt(val)),
  session_id: z.string().min(1),
});

const checkoutSessionMetadataSchema = z.object({
  teamSlug: z.string(),
  teamName: z.string(),
  userId: z.string().transform(Number),
});

const generateRandomString = () => {
  return Math.random().toString(36).substring(2, 10);
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { session_id } = querySchema.parse(req.query);

  const checkoutSession = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["subscription"],
  });
  if (!checkoutSession) throw new HttpError({ statusCode: 404, message: "Checkout session not found" });

  const subscription = checkoutSession.subscription as Stripe.Subscription;
  const currentDate = new Date();
  const trialPeriodDays = checkoutSession.subscription_data?.trial_period_days || 14;

  const trialEndDate = new Date(currentDate.getTime() + trialPeriodDays * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: parseInt(checkoutSession.metadata.userId) },
    data: {
      trialEndsAt: trialEndDate,
    },
  });

  // Let's query to ensure that the team metadata carried over from the checkout session.
  const parseCheckoutSessionMetadata = checkoutSessionMetadataSchema.safeParse(checkoutSession.metadata);

  if (!parseCheckoutSessionMetadata.success) {
    console.error(
      "User metadata not found in checkout session",
      parseCheckoutSessionMetadata.error,
      checkoutSession.id
    );
  }

  if (!checkoutSession.metadata?.userId) {
    throw new HttpError({
      statusCode: 400,
      message: "Can't publish team/org without userId",
    });
  }

  const checkoutSessionMetadata = parseCheckoutSessionMetadata.success
    ? parseCheckoutSessionMetadata.data
    : {
        teamSlug: checkoutSession?.metadata?.teamSlug ?? generateRandomString(),
        teamName: checkoutSession?.metadata?.teamName ?? generateRandomString(),
        userId: checkoutSession.metadata.userId,
      };

  const team = await prisma.team.create({
    data: {
      name: checkoutSessionMetadata.teamName,
      slug: checkoutSessionMetadata.teamSlug,
      members: {
        create: {
          userId: checkoutSessionMetadata.userId as number,
          role: MembershipRole.OWNER,
          accepted: true,
        },
      },
      metadata: {
        paidForByUserId: parseInt(checkoutSession.metadata.userId),
        subscriptionStatus: "trial",
      },
    },
  });

  const prevUser = await prisma.user.findFirstOrThrow({
    where: { id: parseInt(checkoutSession.metadata.userId) },
  });

  const usermetadata = userMetadata.safeParse(prevUser.metadata);
  if (!usermetadata.success) throw new HttpError({ statusCode: 400, message: "Invalid user metadata" });

  const prevMetadata = usermetadata.data;
  const user = await prisma.user.update({
    where: { id: parseInt(checkoutSession.metadata.userId) },
    data: {
      metadata: {
        ...prevMetadata,
        paymentId: checkoutSession.id,
        subscriptionId: subscription.id || null,
        subscriptionItemId: subscription.items.data[0].id || null,
      },
    },
  });

  // redirect to team screen
  res.redirect(302, `/settings/teams/${team.id}/onboard-members?event=team_created`);
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(handler) }),
});
