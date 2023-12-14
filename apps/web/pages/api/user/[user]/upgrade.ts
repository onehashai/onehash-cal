//On merge conflict always use the present changes
import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { z } from "zod";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import stripe from "@calcom/features/ee/payments/server/stripe";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { HttpError } from "@calcom/lib/http-error";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import { teamsOwnedByAdmin } from "@calcom/lib/server/queries/teams";
import prisma from "@calcom/prisma";
import { userMetadata } from "@calcom/prisma/zod-utils";
import { parseTeamMetadataOrThrow } from "@calcom/trpc/server/routers/viewer/teams/publish.handler";

import { TRPCError } from "@trpc/server";

const querySchema = z.object({
  user: z.string().transform((val) => parseInt(val)),
  session_id: z.string().min(1),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user: id, session_id } = querySchema.parse(req.query);

  const checkoutSession = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["subscription"],
  });
  console.log(checkoutSession);
  if (!checkoutSession) throw new HttpError({ statusCode: 404, message: "Checkout session not found" });

  const subscription = checkoutSession.subscription as Stripe.Subscription;
  console.log(subscription);
  const currentDate = new Date();
  const trialPeriodDays = checkoutSession.subscription_data?.trial_period_days || 14;

  const trialEndDate = new Date(currentDate.getTime() + trialPeriodDays * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: id },
    data: {
      trialEndsAt: trialEndDate,
    },
  });
  /* Check if a user already with this payment intent */
  let user = await prisma.user.findFirst({
    where: { metadata: { path: ["paymentId"], equals: checkoutSession.id } },
  });

  let metadata;

  if (!user) {
    const prevUser = await prisma.user.findFirstOrThrow({ where: { id } });

    metadata = userMetadata.safeParse(prevUser.metadata);
    if (!metadata.success) throw new HttpError({ statusCode: 400, message: "Invalid user metadata" });

    const newMetadata = metadata.data;
    /** We save the metadata first to prevent duplicate payments */
    user = await prisma.user.update({
      where: { id },
      data: {
        metadata: {
          ...newMetadata,
          paymentId: checkoutSession.id,
          subscriptionId: subscription.id || null,
          subscriptionItemId: subscription.items.data[0].id || null,
        },
      },
    });

    const allAdminTeams = await teamsOwnedByAdmin(id);
    allAdminTeams.map(async (adminTeam) => {
      const teamId = adminTeam.id;
      const teamMetadata = parseTeamMetadataOrThrow(adminTeam.metadata);
      if (!teamMetadata?.requestedSlug) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Can't publish teams without `requestedSlug`" });
      }
      await prisma.team.update({
        where: { id: teamId },
        data: {
          slug: teamMetadata.requestedSlug as string,
          metadata: {
            paidForByUserId: id,
            subscriptionStatus: "trial",
          },
        },
      });
    });
  }

  if (!metadata) {
    metadata = userMetadata.safeParse(user.metadata);
    if (!metadata.success) throw new HttpError({ statusCode: 400, message: "Invalid user metadata" });
  }

  const session = await getServerSession({ req, res });

  if (!session) return { message: "User upgraded successfully" };

  const redirectUrl = `${WEBAPP_URL}/settings/my-account/profile?upgraded=true`;

  // redirect to user screen
  res.redirect(302, redirectUrl);
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(handler) }),
});
