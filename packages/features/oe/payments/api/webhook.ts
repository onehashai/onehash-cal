import type { Prisma } from "@prisma/client";
import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";

import stripe from "@calcom/app-store/stripepayment/lib/server";
import EventManager from "@calcom/core/EventManager";
import { sendAttendeeRequestEmailAndSMS, sendOrganizerRequestEmail } from "@calcom/emails";
import { doesBookingRequireConfirmation } from "@calcom/features/bookings/lib/doesBookingRequireConfirmation";
import { handleConfirmation } from "@calcom/features/bookings/lib/handleConfirmation";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { getErrorFromUnknown } from "@calcom/lib/errors";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { getBooking } from "@calcom/lib/payment/getBooking";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import { safeStringify } from "@calcom/lib/safeStringify";
import { prisma } from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";

const webhookLogger = logger.getSubLogger({ prefix: ["[paymentWebhook]"] });

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function handleStripePaymentSuccess(stripeEvent: Stripe.Event): Promise<void> {
  const intentObject = stripeEvent.data.object as Stripe.PaymentIntent;

  const paymentRecord = await prisma.payment.findFirst({
    where: {
      externalId: intentObject.id,
    },
    select: {
      id: true,
      bookingId: true,
    },
  });

  if (!paymentRecord?.bookingId) {
    webhookLogger.error(
      "Stripe: Payment Record Missing",
      safeStringify(intentObject),
      safeStringify(paymentRecord)
    );
    throw new HttpCode({ statusCode: 204, message: "Payment not found" });
  }

  if (!paymentRecord?.bookingId) {
    throw new HttpCode({ statusCode: 204, message: "Payment not found" });
  }

  await handlePaymentSuccess(paymentRecord.id, paymentRecord.bookingId);
}

const processSetupIntentSuccess = async (stripeEvent: Stripe.Event): Promise<void> => {
  const setupIntentData = stripeEvent.data.object as Stripe.SetupIntent;

  const paymentEntity = await prisma.payment.findFirst({
    where: {
      externalId: setupIntentData.id,
    },
  });

  if (!paymentEntity?.data || !paymentEntity?.id) {
    throw new HttpCode({ statusCode: 204, message: "Payment not found" });
  }

  const { booking, user, evt, eventType } = await getBooking(paymentEntity.bookingId);

  const reservationUpdateData: Prisma.BookingUpdateInput = {
    paid: true,
  };

  if (!user) {
    throw new HttpCode({ statusCode: 204, message: "No user found" });
  }

  const needsConfirmation = doesBookingRequireConfirmation({
    booking: {
      ...booking,
      eventType,
    },
  });

  if (!needsConfirmation) {
    const calendarManager = new EventManager(user, eventType?.metadata?.apps);
    const creationResult = await calendarManager.create(evt);
    reservationUpdateData.references = { create: creationResult.referencesToCreate };
    reservationUpdateData.status = BookingStatus.ACCEPTED;
  }

  await prisma.payment.update({
    where: {
      id: paymentEntity.id,
    },
    data: {
      data: {
        ...(paymentEntity.data as Prisma.JsonObject),
        setupIntent: setupIntentData as unknown as Prisma.JsonObject,
      },
      booking: {
        update: {
          ...reservationUpdateData,
        },
      },
    },
  });

  if (!needsConfirmation) {
    await handleConfirmation({
      user,
      evt,
      prisma,
      bookingId: booking.id,
      booking,
      paid: true,
    });
  } else {
    await sendOrganizerRequestEmail({ ...evt }, eventType.metadata);
    await sendAttendeeRequestEmailAndSMS({ ...evt }, evt.attendees[0], eventType.metadata);
  }
};

type EventProcessor = (event: Stripe.Event) => Promise<void>;

const stripeEventProcessors: Record<string, EventProcessor | undefined> = {
  "payment_intent.succeeded": handleStripePaymentSuccess,
  "setup_intent.succeeded": processSetupIntentSuccess,
};

export default async function handler(request: NextApiRequest, response: NextApiResponse): Promise<void> {
  try {
    if (request.method !== "POST") {
      throw new HttpCode({ statusCode: 405, message: "Method Not Allowed" });
    }

    const signature = request.headers["stripe-signature"];
    if (!signature) {
      throw new HttpCode({ statusCode: 400, message: "Missing stripe-signature" });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new HttpCode({ statusCode: 500, message: "Missing process.env.STRIPE_WEBHOOK_SECRET" });
    }

    const requestBuffer = await buffer(request);
    const payloadString = requestBuffer.toString();

    const constructedEvent = stripe.webhooks.constructEvent(
      payloadString,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (!constructedEvent.account && !process.env.NEXT_PUBLIC_IS_E2E) {
      throw new HttpCode({ statusCode: 202, message: "Incoming connected account" });
    }

    const eventProcessor = stripeEventProcessors[constructedEvent.type];
    if (eventProcessor) {
      await eventProcessor(constructedEvent);
    } else {
      throw new HttpCode({
        statusCode: 202,
        message: `Unhandled Stripe Webhook event type ${constructedEvent.type}`,
      });
    }
  } catch (error) {
    const processedError = getErrorFromUnknown(error);
    console.error(`Webhook Error: ${processedError.message}`);
    response.status(processedError.statusCode ?? 500).send({
      message: processedError.message,
      stack: IS_PRODUCTION ? undefined : processedError.stack,
    });
    return;
  }

  response.json({ received: true });
}
