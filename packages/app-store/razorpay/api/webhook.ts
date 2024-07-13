//WEBHOOK EVENTS ASSOCIATED EXAMPLE PAYLOADS : https://razorpay.com/docs/webhooks/payloads/payments/
import type { NextApiRequest, NextApiResponse } from "next";
import { findPaymentCredentials } from "razorpay/lib/getAppConfigsByBookingID";
import { z } from "zod";

import { default as Razorpay, WebhookEvents } from "@calcom/app-store/razorpay/lib/Razorpay";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { getErrorFromUnknown } from "@calcom/lib/errors";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import prisma from "@calcom/prisma";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function handleRazorpayPaymentSuccess(orderId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      externalId: orderId,
    },
    select: {
      id: true,
      bookingId: true,
    },
  });

  if (!payment?.bookingId) throw new HttpCode({ statusCode: 204, message: "Payment not found" });

  const booking = await prisma.booking.findUnique({
    where: {
      id: payment.bookingId,
    },
    select: {
      id: true,
    },
  });

  if (!booking) throw new HttpCode({ statusCode: 204, message: "No booking found" });
  // Probably booking it's already paid from /capture but we need to send confirmation email
  const foundCredentials = await findPaymentCredentials(booking.id);
  if (!foundCredentials) throw new HttpCode({ statusCode: 204, message: "No credentials found" });
  return await handlePaymentSuccess(payment.id, payment.bookingId);
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
    const { event, payload } = req.body;
    switch (event) {
      case WebhookEvents.PAYMENT_CAPTURED:
        await handleRazorpayPaymentSuccess(payload.payment.entity.order_id);
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
