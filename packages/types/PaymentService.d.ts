import type { Payment, Prisma, Booking, PaymentOption } from "@prisma/client";

import type { CalendarEvent } from "@calcom/types/Calendar";

export interface PaymentApp {
  lib?: {
    PaymentService: PaymentService;
  };
}

interface PaymentService {
  new (credentials: { key: Prisma.JsonValue }): IAbstractPaymentService;
}

export interface IAbstractPaymentService {
  /* This method is for creating charges at the time of booking */
  create({
    payment,
    bookingId,
    userId,
    username,
    bookerName,
    paymentOption,
    bookingUid,
    bookerEmail,
    bookerPhoneNumber,
    eventTitle,
    bookingTitle,
  }: {
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">;
    bookingId: Booking["id"];
    userId: Booking["userId"];
    username: string | null;
    bookerName: string;
    paymentOption: PaymentOption;
    bookingUid: string;
    bookerEmail: string;
    bookerPhoneNumber?: string | null;
    eventTitle?: string;
    bookingTitle?: string;
    responses?: Prisma.JsonValue;
  }): Promise<Payment>;
  /* This method is to collect card details to charge at a later date ex. no-show fees */
  collectCard(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId: Booking["id"],
    paymentOption: PaymentOption,
    bookerEmail: string,
    bookerPhoneNumber?: string | null
  ): Promise<Payment>;
  chargeCard(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId?: Booking["id"]
  ): Promise<Payment>;

  update(paymentId: Payment["id"], data: Partial<Prisma.PaymentUncheckedCreateInput>): Promise<Payment>;
  refund(paymentId: Payment["id"]): Promise<Payment>;
  getPaymentPaidStatus(): Promise<string>;
  getPaymentDetails(): Promise<Payment>;
  afterPayment(
    event: CalendarEvent,
    booking: {
      user: { email: string | null; name: string | null; timeZone: string } | null;
      id: number;
      startTime: { toISOString: () => string };
      uid: string;
    },
    paymentData: Payment,
    eventTypeMetadata?: EventTypeMetadata
  ): Promise<void>;
  deletePayment(paymentId: Payment["id"]): Promise<boolean>;
  isSetupAlready(): boolean;
}
