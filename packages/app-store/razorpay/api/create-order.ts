import type { NextApiResponse, NextApiRequest } from "next";
import { z } from "zod";

import prisma from "@calcom/prisma";

import { default as RazorpayPaymentService } from "../lib/PaymentService";
import { findPaymentCredentials } from "../lib/getAppConfigsByBookingID";

const createOrderRequestSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  bookingId: z.string(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: "You must be logged in to do this" });
    }
    const parseRequest = createOrderRequestSchema.safeParse(req.query);
    if (!parseRequest.success) return res.status(400).json({ message: "Request is malformed" });
    const { amount, currency, bookingId } = parseRequest.data;
    // Get booking credentials
    const booking = await prisma.booking.findUnique({
      where: {
        uid: bookingId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const credentials = await findPaymentCredentials(booking?.id);

    if (!credentials) {
      throw new Error("Credentials not found");
    }

    // Get razorpay instance
    const paymentService = new RazorpayPaymentService({ key: credentials });
    const order = await paymentService.create(
      {
        amount,
        currency,
      },
      booking.id
    );
    return {
      amount: order.amount,
      currency: order.currency,
      id: order.id,
    };
  } else {
    return res.status(405).json({ message: "Method not allowed" });
  }
}
