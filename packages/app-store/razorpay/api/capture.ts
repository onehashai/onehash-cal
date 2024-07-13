import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import prisma from "@calcom/prisma";

import { findPaymentCredentials } from "../lib/getAppConfigsByBookingID";

const captureRequestSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
  bookingId: z.string(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const validated = captureRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.json({ message: "Request is malformed", isOk: false });
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = validated.data;
    const credentials = await findPaymentCredentials(Number(bookingId));

    if (!credentials) {
      return res.json({ message: "Razorpay not configured", isOk: false });
    }

    const signature = generatedSignature({
      razorpayOrderId,
      razorpayPaymentId,
      keySecret: credentials.key_secret,
    });
    if (signature !== razorpaySignature) {
      return res.json({
        message: "Payment signature mismatch",
        isOk: false,
        redirect: `/booking/${bookingId}?razorpayPaymentStatus=failed`,
      });
    }
    const payment = await prisma.payment.findUnique({
      where: {
        externalId: razorpayOrderId,
      },
      select: {
        id: true,
      },
    });
    if (!payment) {
      return res.json({
        message: "Payment was not initiated from our system",
        isOk: false,
        redirect: `/booking/${bookingId}?razorpayPaymentStatus=failed`,
      });
    }
    await handlePaymentSuccess(payment.id, Number(bookingId));
    return res.json({ redirect: `/booking/${bookingId}?razorpayPaymentStatus=success`, isOk: true });
  } else {
    return res.status(405).json({ message: "Method not allowed", isOk: false });
  }
}

const generatedSignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  keySecret,
}: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  keySecret: string;
}) => {
  if (!keySecret) {
    throw new Error("Razorpay key secret is not defined in environment variables.");
  }
  const sig = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return sig;
};
