//WEBHOOK EVENTS ASSOCIATED EXAMPLE PAYLOADS : https://razorpay.com/docs/webhooks/payloads/payments/
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { default as Razorpay, WebhookEvents } from "@calcom/app-store/razorpay/lib/Razorpay";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { getErrorFromUnknown } from "@calcom/lib/errors";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import { prisma } from "@calcom/prisma";

export const config = {
  api: {
    bodyParser: false,
  },
};
async function detachAppFromEvents(where) {
  //detaching razorpay from eventtypes, if any
  const eventTypes = await prisma.eventType.findMany({
    where,
  });

  // Iterate over each EventType record
  for (const eventType of eventTypes) {
    const metadata = isPrismaObjOrUndefined(eventType.metadata);

    if (metadata?.apps && metadata?.apps?.razorpay) {
      delete metadata.apps.razorpay;

      await prisma.eventType.update({
        where: {
          id: eventType.id,
        },
        data: {
          metadata: metadata,
        },
      });
    }
  }
}

async function handleAppRevoked(accountId: string) {
  const credential = await prisma.credential.findFirst({
    where: {
      key: {
        path: ["account_id"],
        equals: accountId,
      },
      appId: "razorpay",
    },
  });
  if (!credential) throw new HttpCode({ statusCode: 204, message: "No credentials found" });
  const userId = credential.userId;

  if (userId) {
    await detachAppFromEvents({
      metadata: {
        not: null,
      },
      userId: userId,
    });
  }

  const teamId = credential.teamId;
  if (teamId) {
    await detachAppFromEvents({
      metadata: {
        not: null,
      },
      teamId: teamId,
    });
  }

  //removing the razorpay app from user/team account
  await prisma.credential.delete({
    where: {
      id: credential.id,
    },
  });
  return;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      throw new HttpCode({ statusCode: 405, message: "Method Not Allowed" });
    }
    const parsedVerifyWebhook = verifyWebhookSchema.safeParse({
      body: JSON.stringify(req.body),
      signature: req.headers["x-razorpay-signature"],
    });
    if (!parsedVerifyWebhook.success) {
      console.error("Razorpay webhook malformed");
      throw new HttpCode({ statusCode: 400, message: "Bad Request" });
    }
    const isValid = Razorpay.verifyWebhook(parsedVerifyWebhook.data);
    if (!isValid) {
      console.error("Razorpay webhook signature mismatch");
      throw new HttpCode({ statusCode: 400, message: "Bad Request" });
    }
    const { event, account_id } = req.body;
    switch (event) {
      case WebhookEvents.APP_REVOKED:
        await handleAppRevoked(account_id);
        break;
      default:
        console.error("Razorpay webhook event not handled");
        throw new HttpCode({ statusCode: 204, message: "No event handler found" });
    }
    // Returning a response to acknowledge receipt of the event
    return res.status(200).end();
  } catch (_err) {
    const err = getErrorFromUnknown(_err);
    console.error(`Webhook Error: ${err.message}`);
    res.status(200).send({
      message: err.message,
      stack: IS_PRODUCTION ? undefined : err.stack,
    });
    return;
  }
}

const verifyWebhookSchema = z
  .object({
    body: z.string().min(1),
    signature: z.string().min(1),
  })
  .passthrough();
