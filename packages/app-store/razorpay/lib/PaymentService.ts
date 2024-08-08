import type { Booking, Payment, PaymentOption, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import z from "zod";

import { default as Razorpay } from "@calcom/app-store/razorpay/lib/Razorpay";
import { ErrorCode } from "@calcom/lib/errorCodes";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import type { IAbstractPaymentService } from "@calcom/types/PaymentService";

import { paymentOptionEnum } from "../zod";

const log = logger.getSubLogger({ prefix: ["payment-service:razorpay"] });

export const razorpayCredentialKeysSchema = z.object({
  keys: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    public_token: z.string(),
    account_id: z.string(),
  }),
  userId: z.number(),
});
export default class PaymentService implements IAbstractPaymentService {
  private credentials: z.infer<typeof razorpayCredentialKeysSchema> | null;

  constructor(credentials: { keys: Prisma.JsonValue; userId: number }) {
    const keyParsing = razorpayCredentialKeysSchema.safeParse(credentials);
    if (keyParsing.success) {
      this.credentials = keyParsing.data;
    } else {
      this.credentials = null;
    }
  }

  async create(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId: Booking["id"]
  ) {
    try {
      if (!this.credentials) {
        throw new Error("Razorpay: Credentials are not set for the payment service");
      }

      const uid = uuidv4();

      const razorpayClient = new Razorpay({
        access_token: this.credentials.keys.access_token,
        refresh_token: this.credentials.keys.refresh_token,
        user_id: this.credentials.userId,
      });

      const orderResult = await razorpayClient.createOrder({
        referenceId: uid,
        amount: payment.amount,
        currency: payment.currency,
      });
      const paymentData = await prisma.payment.create({
        data: {
          uid,
          app: {
            connect: {
              slug: "razorpay",
            },
          },
          booking: {
            connect: {
              id: bookingId,
            },
          },
          amount: payment.amount,
          externalId: orderResult.id,
          currency: payment.currency,
          data: Object.assign(
            {},
            {
              order: orderResult,
              key: {
                merchant_id: this.credentials.keys.account_id,
              },
            }
          ) as unknown as Prisma.InputJsonValue,
          fee: 0,
          refunded: false,
          success: false,
        },
      });

      if (!paymentData) {
        throw new Error();
      }
      return paymentData;
    } catch (error) {
      log.error("Razorpay: Payment could not be created for bookingId", bookingId, safeStringify(error));
      throw new Error(ErrorCode.PaymentCreationFailure);
    }
  }
  async update(): Promise<Payment> {
    throw new Error("Method not implemented.");
  }
  async refund(): Promise<Payment> {
    throw new Error("Method not implemented.");
  }

  async collectCard(
    payment: Pick<Prisma.PaymentUncheckedCreateInput, "amount" | "currency">,
    bookingId: number,
    _bookerEmail: string,
    paymentOption: PaymentOption
  ): Promise<Payment> {
    // Ensure that the payment service can support the passed payment option
    if (paymentOptionEnum.parse(paymentOption) !== "HOLD") {
      throw new Error("Payment option is not compatible with create method");
    }
    try {
      const booking = await prisma.booking.findFirst({
        select: {
          uid: true,
          title: true,
        },
        where: {
          id: bookingId,
        },
      });
      if (!booking || !this.credentials) {
        throw new Error();
      }

      const uid = uuidv4();

      const razorpayClient = new Razorpay({
        access_token: this.credentials.keys.access_token,
        refresh_token: this.credentials.keys.refresh_token,
        user_id: this.credentials.userId,
      });
      const preference = await razorpayClient.createOrder({
        referenceId: uid,
        amount: payment.amount,
        currency: payment.currency,
      });

      const paymentData = await prisma.payment.create({
        data: {
          uid,
          app: {
            connect: {
              slug: "razorpay",
            },
          },
          booking: {
            connect: {
              id: bookingId,
            },
          },
          amount: payment.amount,
          currency: payment.currency,
          data: Object.assign({}, preference) as unknown as Prisma.InputJsonValue,
          fee: 0,
          refunded: false,
          success: false,
          paymentOption: paymentOption || "ON_BOOKING",
          externalId: preference?.id,
        },
      });

      if (!paymentData) {
        throw new Error();
      }
      return paymentData;
    } catch (error) {
      log.error(
        "Razorpay: Payment method could not be collected for bookingId",
        bookingId,
        safeStringify(error)
      );
      throw new Error("Razorpay: Payment method could not be collected");
    }
  }
  chargeCard(): Promise<Payment> {
    throw new Error("Method not implemented.");
  }
  getPaymentPaidStatus(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getPaymentDetails(): Promise<Payment> {
    throw new Error("Method not implemented.");
  }
  afterPayment(): Promise<void> {
    return Promise.resolve();
  }
  deletePayment(): Promise<boolean> {
    return Promise.resolve(false);
  }

  isSetupAlready(): boolean {
    return !!this.credentials;
  }
}
