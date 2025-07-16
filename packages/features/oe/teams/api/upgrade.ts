import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { z } from "zod";

import { getRequestedSlugError } from "@calcom/app-store/stripepayment/lib/team-billing";
import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import stripe from "@calcom/features/ee/payments/server/stripe";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { HttpError } from "@calcom/lib/http-error";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import prisma from "@calcom/prisma";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";

const requestSchema = z.object({
  team: z.string().transform((value) => parseInt(value)),
  session_id: z.string().min(1),
});

const processUpgradeRequest = async (request: NextApiRequest, response: NextApiResponse) => {
  const { team: teamIdentifier, session_id: sessionIdentifier } = requestSchema.parse(request.query);

  const retrievedSession = await stripe.checkout.sessions.retrieve(sessionIdentifier, {
    expand: ["subscription"],
  });

  if (!retrievedSession) {
    throw new HttpError({ statusCode: 404, message: "Checkout session not found" });
  }

  const stripeSubscription = retrievedSession.subscription as Stripe.Subscription;

  if (retrievedSession.payment_status !== "paid") {
    throw new HttpError({ statusCode: 402, message: "Payment required" });
  }

  let existingTeam = await prisma.team.findFirst({
    where: { metadata: { path: ["paymentId"], equals: retrievedSession.id } },
  });

  let parsedMetadata;

  if (!existingTeam) {
    const originalTeam = await prisma.team.findFirstOrThrow({ where: { id: teamIdentifier } });

    parsedMetadata = teamMetadataSchema.safeParse(originalTeam.metadata);

    if (!parsedMetadata.success) {
      throw new HttpError({ statusCode: 400, message: "Invalid team metadata" });
    }

    const { requestedSlug, ...remainingMetadata } = parsedMetadata.data || {};

    existingTeam = await prisma.team.update({
      where: { id: teamIdentifier },
      data: {
        metadata: {
          ...remainingMetadata,
          paymentId: retrievedSession.id,
          subscriptionId: stripeSubscription.id || null,
          subscriptionItemId: stripeSubscription.items.data[0].id || null,
        },
      },
    });

    const teamSlug = originalTeam.slug || requestedSlug;
    if (teamSlug) {
      try {
        existingTeam = await prisma.team.update({
          where: { id: teamIdentifier },
          data: { slug: teamSlug },
        });
      } catch (upgradeError) {
        const { message: errorMessage, statusCode: errorStatus } = getRequestedSlugError(
          upgradeError,
          teamSlug
        );
        return response.status(errorStatus).json({ message: errorMessage });
      }
    }
  }

  if (!parsedMetadata) {
    parsedMetadata = teamMetadataSchema.safeParse(existingTeam.metadata);
    if (!parsedMetadata.success) {
      throw new HttpError({ statusCode: 400, message: "Invalid team metadata" });
    }
  }

  const userSession = await getServerSession({ req: request, res: response });

  if (!userSession) {
    return { message: "Team upgraded successfully" };
  }

  const destinationUrl = existingTeam?.isOrganization
    ? `${WEBAPP_URL}/settings/organizations/profile?upgraded=true`
    : `${WEBAPP_URL}/settings/teams/${existingTeam.id}/profile?upgraded=true`;

  response.redirect(302, destinationUrl);
};

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(processUpgradeRequest) }),
});
