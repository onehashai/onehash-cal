import { z } from "zod";

import prisma from "@calcom/prisma";

const razorpayCredentialKeysSchema = z.object({
  key_id: z.string(),
  key_secret: z.string(),
  webhook_id: z.string().optional().default(""),
  merchant_id: z.string().optional().default(""),
});

export const findPaymentCredentials = async (
  bookingId: number
): Promise<{ key_id: string; key_secret: string; webhook_id: string; merchant_id: string }> => {
  try {
    // @TODO: what about team bookings with razorpay?
    const userFromBooking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!userFromBooking) throw new Error("No user found");

    const credentials = await prisma.credential.findFirst({
      where: {
        appId: "razorpay",
        userId: userFromBooking?.userId,
      },
      select: {
        key: true,
      },
    });
    if (!credentials) {
      throw new Error("No credentials found");
    }
    const parsedCredentials = razorpayCredentialKeysSchema.safeParse(credentials?.key);
    if (!parsedCredentials.success) {
      throw new Error("Credentials malformed");
    }

    return {
      key_id: parsedCredentials.data.key_id,
      key_secret: parsedCredentials.data.key_secret,
      merchant_id: parsedCredentials.data.merchant_id,
      webhook_id: parsedCredentials.data.webhook_id,
    };
  } catch (err) {
    console.error(err);
    throw new Error("No credentials found");
  }
};
