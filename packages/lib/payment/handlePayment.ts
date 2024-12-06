import type { AppCategories, Prisma } from "@prisma/client";

import appStore from "@calcom/app-store";
import type { EventTypeAppsList } from "@calcom/app-store/utils";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { ErrorCode } from "@calcom/lib/errorCodes";
import prisma from "@calcom/prisma";
import type { CompleteEventType } from "@calcom/prisma/zod";
import type { CalendarEvent } from "@calcom/types/Calendar";
import type { IAbstractPaymentService, PaymentApp } from "@calcom/types/PaymentService";

const handlePayment = async (
  evt: CalendarEvent,
  selectedEventType: Pick<CompleteEventType, "metadata" | "title">,
  paymentAppCredentials: {
    key: Prisma.JsonValue;
    appId: EventTypeAppsList;
    app: {
      dirName: string;
      categories: AppCategories[];
    } | null;
  },
  booking: {
    user: { email: string | null; name: string | null; timeZone: string; username: string | null } | null;
    id: number;
    userId: number | null;
    startTime: { toISOString: () => string };
    uid: string;
    metadata: Prisma.JsonValue;
    responses?: Prisma.JsonValue;
  },
  bookerName: string,
  bookerEmail: string,
  bookerPhoneNumber?: string | null
) => {
  const paymentApp = (await appStore[
    paymentAppCredentials?.app?.dirName as keyof typeof appStore
  ]?.()) as PaymentApp;
  if (!paymentApp?.lib?.PaymentService) {
    console.warn(`payment App service of type ${paymentApp} is not implemented`);
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PaymentService = paymentApp.lib.PaymentService as any;

  const paymentInstance = new PaymentService(paymentAppCredentials) as IAbstractPaymentService;

  const paymentOption =
    selectedEventType?.metadata?.apps?.[paymentAppCredentials.appId].paymentOption || "ON_BOOKING";

  let paymentData;
  try {
    if (paymentOption === "HOLD") {
      paymentData = await paymentInstance.collectCard(
        {
          amount: selectedEventType?.metadata?.apps?.[paymentAppCredentials.appId].price,
          currency: selectedEventType?.metadata?.apps?.[paymentAppCredentials.appId].currency,
        },
        booking.id,
        paymentOption,
        bookerEmail,
        bookerPhoneNumber
      );
    } else {
      paymentData = await paymentInstance.create({
        payment: {
          amount: selectedEventType?.metadata?.apps?.[paymentAppCredentials.appId].price,
          currency: selectedEventType?.metadata?.apps?.[paymentAppCredentials.appId].currency,
        },
        bookingId: booking.id,
        userId: booking.userId,
        username: booking.user?.username ?? null,
        bookerName: bookerName,
        paymentOption: paymentOption,
        bookingUid: booking.uid,
        bookerPhoneNumber: bookerPhoneNumber,
        bookerEmail: bookerEmail,
        eventTitle: selectedEventType.title,
        bookingTitle: evt.title,
        ...(booking.responses && {
          responses: booking.responses,
        }),
      });
    }

    if (!paymentData) {
      console.error("Payment could not be created");
      throw new Error("Payment could not be created");
    }
    try {
      await paymentInstance.afterPayment(evt, booking, paymentData, selectedEventType?.metadata);
    } catch (e) {
      console.error(e);
    }
    return paymentData;
  } catch (e) {
    if (e instanceof Error && e.message === ErrorCode.PaymentCreationFailure) {
      const _metadata = isPrismaObjOrUndefined(booking.metadata) ? (booking.metadata as object) : {};
      await prisma.booking.update({
        where: {
          id: booking.id,
        },
        data: {
          metadata: {
            ..._metadata,
            paymentStatus: "failed",
          },
        },
      });
    }
  }
};

export { handlePayment };
