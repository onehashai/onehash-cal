import type { Payment, EventType } from "@prisma/client";

import appStore from "@calcom/app-store";
import prisma from "@calcom/prisma";
import type { IAbstractPaymentService, PaymentApp } from "@calcom/types/PaymentService";

export interface BookingCancelPaymentHandlerInput {
  payment: Payment[];
  eventType: EventType;
}

const bookingCancelPaymentHandler = async (booking: BookingCancelPaymentHandlerInput) => {
  if (!!booking.payment.length) {
    let eventTypeOwnerId;
    console.log("bookingEventOwnerd", booking.eventType.owner.id);
    if (booking.eventType?.owner) {
      eventTypeOwnerId = booking.eventType.owner.id;
    } else if (booking.eventType?.teamId) {
      const teamOwner = await prisma.membership.findFirst({
        where: {
          teamId: booking.eventType.teamId,
          role: MembershipRole.OWNER,
        },
        select: {
          userId: true,
        },
      });
      eventTypeOwnerId = teamOwner?.userId;
    }

    if (!eventTypeOwnerId) {
      throw new Error("Event Type owner not found for obtaining payment app credentials");
    }
    console.log("payment", booking.payment);
    const successPayment = booking.payment.find((payment) => payment.success);

    const paymentAppCredentials = await prisma.credential.findMany({
      where: {
        userId: eventTypeOwnerId,
        appId: successPayment.appId,
      },
      select: {
        key: true,
        appId: true,
        app: {
          select: {
            categories: true,
            dirName: true,
          },
        },
      },
    });

    const paymentAppCredential = paymentAppCredentials.find((credential) => {
      return credential.appId === successPayment.appId;
    });

    if (!paymentAppCredential) {
      throw new Error("Payment app credentials not found");
    }

    const paymentApp = (await appStore[
      paymentAppCredential?.app?.dirName as keyof typeof appStore
    ]?.()) as PaymentApp;
    if (!paymentApp?.lib?.PaymentService) {
      console.warn(`payment App service of type ${paymentApp} is not implemented`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PaymentService = paymentApp.lib.PaymentService as any;
    const paymentInstance = new PaymentService(paymentAppCredential) as IAbstractPaymentService;
    if (!successPayment) {
      const paymentData = await paymentInstance.deletePayment(successPayment.id);
      if (!paymentData.deleted) {
        throw new Error("Payment could not be deleted");
      }
    } else {
      const paymentData = await paymentInstance.refund(successPayment.id);
      if (!paymentData.refunded) {
        throw new Error("Payment could not be refunded");
      }
    }
  }
};

export default bookingCancelPaymentHandler;
