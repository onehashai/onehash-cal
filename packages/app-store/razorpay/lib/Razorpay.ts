import Razorpay from "razorpay";
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";

import { WEBAPP_URL } from "@calcom/lib/constants";
import logger from "@calcom/lib/logger";

class RazorpayWrapper {
  key_id: string;
  key_secret: string;
  merchant_id: string;
  instance: Razorpay;

  constructor({
    key_id,
    key_secret,
    merchant_id,
  }: {
    key_id: string;
    key_secret: string;
    merchant_id: string;
  }) {
    this.key_id = key_id;
    this.key_secret = key_secret;
    this.merchant_id = merchant_id;
    this.instance = new Razorpay({
      key_id: this.key_id,
      key_secret: this.key_secret,
    });
  }

  async test(): Promise<boolean> {
    try {
      await this.instance.payments.all();
      return true;
    } catch (error) {
      return false;
    }
  }
  // Orders
  async createOrder({
    referenceId,
    amount,
    currency,
  }: {
    referenceId: string;
    amount: number;
    currency: string;
  }): Promise<CreateOrderResponse> {
    try {
      const order = await this.instance.orders.create({
        currency,
        amount,
        receipt: referenceId,
      });
      return order as CreateOrderResponse;
    } catch (error) {
      console.error(error);
    }
    return {} as CreateOrderResponse;
  }

  //Webh
  async createWebhook(): Promise<string> {
    try {
      const result = await this.instance.webhooks.create({
        url: `${WEBAPP_URL}/api/integrations/razorpay/webhook`,
        secret: process.env.RAZORPAY_WEBHOOK_SECRET as string,
        events: ["order.paid"],
      });
      console.log("Webhook created", result.id);
      return result.id as string;
    } catch (e) {
      console.log("Error creating webhook", e);
      logger.error("Error creating webhook", e);
      throw e;
    }
  }

  async listWebhooks(): Promise<string[]> {
    try {
      console.log();
      const res = await this.instance.webhooks.all({
        count: 100,
      });
      const { items: webhooks } = res;

      return webhooks
        .filter((webhook: { id: string; url: string }) => {
          return webhook.url.includes("api/integrations/razorpay/webhook");
        })
        .map((webhook: { id: string }) => webhook.id);
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  async deleteWebhook({ webhookId }: { webhookId: string }): Promise<boolean> {
    try {
      await this.instance.webhooks.delete(webhookId, this.merchant_id);
      return true;
    } catch (error) {
      console.error(error);
    }
    return false;
  }

  verifyWebhook({
    body,
    signature,
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET,
  }: WebhookEventVerifyRequest): boolean {
    if (!webhookSecret) {
      throw new Error("Webhook secret is required");
    }
    return validateWebhookSignature(body, signature, webhookSecret);
  }

  //   async test(): Promise<boolean> {
  //     // Always get a new access token
  //     try {
  //       await this.getAccessToken();
  //     } catch (error) {
  //       console.error(error);
  //       return false;
  //     }
  //     return true;
  //   }

  //   async captureOrder(orderId: string): Promise<boolean> {
  //     try {
  //       const captureResult = await this.fetcher(`/v2/checkout/orders/${orderId}/capture`, {
  //         method: "POST",
  //       });
  //       if (captureResult.ok) {
  //         const result = await captureResult.json();
  //         if (result?.status === "COMPLETED") {
  //           // Get payment reference id

  //           const payment = await prisma.payment.findFirst({
  //             where: {
  //               externalId: orderId,
  //             },
  //             select: {
  //               id: true,
  //               bookingId: true,
  //               data: true,
  //             },
  //           });

  //           if (!payment) {
  //             throw new Error("Payment not found");
  //           }

  //           await prisma.payment.update({
  //             where: {
  //               id: payment?.id,
  //             },
  //             data: {
  //               success: true,
  //               data: Object.assign(
  //                 {},
  //                 { ...(payment?.data as Record<string, string | number>), capture: result.id }
  //               ) as unknown as Prisma.InputJsonValue,
  //             },
  //           });

  //           // Update booking as paid
  //           await prisma.booking.update({
  //             where: {
  //               id: payment.bookingId,
  //             },
  //             data: {
  //               status: "ACCEPTED",
  //             },
  //           });

  //           return true;
  //         }
  //       }
  //     } catch (error) {
  //       console.error(error);
  //       throw error;
  //     }
  //     return false;
  //   }
}

export default RazorpayWrapper;

interface CreateOrderResponse {
  id: string;
  /**
   * Indicates the type of entity.
   */
  entity: string;
  /**
   * The amount paid against the order.
   */
  amount_paid: number;
  /**
   * The amount pending against the order.
   */
  amount_due: number;
  /**
   * The status of the order.
   */
  status: "created" | "attempted" | "paid";
  /**
   * The number of payment attempts, successful and failed,
   * that have been made against this order.
   */
  attempts: number;
  /**
   * Indicates the Unix timestamp when this order was created.
   */
  created_at: number;
  /**
   * A description that appears on the hosted page.
   * For example, `12:30 p.m. Thali meals (Gaurav Kumar)`.
   */
  description: string;
}

interface WebhookEventVerifyRequest {
  /*
  Json stringified body of the webhook event.
  */
  body: string;
  /*
  Signature sent in X-Razorpay-Signature header
  */
  signature: string;
  /*
  The webhook secret used to sign the webhook event.
  */
  webhookSecret?: string;
}
