import type { AxiosInstance, AxiosResponse } from "axios";
import axios from "axios";
import crypto from "crypto";

import { isPrismaObjOrUndefined } from "@calcom/lib";
import { RAZORPAY_CLIENT_ID, RAZORPAY_CLIENT_SECRET, RAZORPAY_WEBHOOK_SECRET } from "@calcom/lib/constants";
import { prisma } from "@calcom/prisma";

export enum WebhookEvents {
  APP_REVOKED = "account.app.authorization_revoked",
}
const razorpay_auth_base_url = "https://auth.razorpay.com";
const razorpay_api_base_url = "https://api.razorpay.com/v1";

interface RazorpayWrapperOptions {
  access_token: string;
  refresh_token: string;
  user_id: number;
}

class RazorpayWrapper {
  private access_token: string;
  private refresh_token: string;

  private user_id: number;
  private axiosInstance: AxiosInstance;

  constructor({ access_token, refresh_token, user_id }: RazorpayWrapperOptions) {
    this.access_token = access_token;
    this.refresh_token = refresh_token;

    this.user_id = user_id;
    this.axiosInstance = axios.create({
      baseURL: razorpay_api_base_url,
      headers: {
        Authorization: `Bearer ${this.access_token}`,
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.access_token) {
          config.headers.Authorization = `Bearer ${this.access_token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status >= 400 && error.response?.status < 500) {
          try {
            await this.refreshAccessToken();

            const originalRequest = error.config;
            originalRequest.headers.Authorization = `Bearer ${this.access_token}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error("Error refreshing token:", refreshError);
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleUpdateToken({
    access_token,
    refresh_token,
    public_token,
  }: {
    access_token: string;
    refresh_token: string;
    public_token: string;
  }) {
    try {
      const existingCredential = await prisma.credential.findFirst({
        where: { userId: this.user_id, appId: "razorpay" },
        select: { key: true, id: true },
      });

      if (!existingCredential) {
        throw new Error("Credential not found");
      }

      const keys = isPrismaObjOrUndefined(existingCredential.key);
      if (!keys) {
        throw new Error("Keys not found");
      }
      const updatedKey = {
        ...keys,
        access_token,
        refresh_token,
        public_token,
      };

      await prisma.credential.update({
        where: { id: existingCredential.id },
        data: { key: updatedKey },
      });

      this.access_token = access_token;
      this.refresh_token = refresh_token;
    } catch (e) {
      console.error("Failed to update credentials:", e);
      throw new Error("Failed to update credentials");
    }
  }

  private async refreshAccessToken() {
    try {
      const response: AxiosResponse<{ access_token: string; refresh_token: string; public_token: string }> =
        await axios.post(`${razorpay_auth_base_url}/token`, {
          client_id: RAZORPAY_CLIENT_ID,
          client_secret: RAZORPAY_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: this.refresh_token,
        });
      await this.handleUpdateToken(response.data);
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw new Error("Failed to refresh token");
    }
  }

  async test(): Promise<boolean> {
    try {
      await this.axiosInstance.get("/payments");
      return true;
    } catch (error) {
      console.error("Test failed:", error);
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
      const res = await this.axiosInstance.post("/orders", {
        currency,
        amount,
        receipt: referenceId,
      });
      return res.data as CreateOrderResponse;
    } catch (error) {
      console.error("Error creating order:", error);
      throw new Error("Error creating order");
    }
  }

  //Payments
  async checkIfPaymentCaptured(paymentId: string): Promise<boolean> {
    try {
      const res = await this.axiosInstance.get(`/payments/${paymentId}`);
      return res.data.captured;
    } catch (error) {
      console.error("Error checking payment:", error);
      throw new Error("Error checking if payment is captured");
    }
  }

  //Webhook

  static verifyWebhook({ body, signature }: WebhookEventVerifyRequest): boolean {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      throw new Error("Webhook secret is required");
    }

    if (!body || !signature || !RAZORPAY_WEBHOOK_SECRET) {
      throw Error(
        "Invalid Parameters: Please give request body," +
          "signature sent in X-Razorpay-Signature header and " +
          "webhook secret from dashboard as parameters"
      );
    }

    const expectedSignature = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");

    return expectedSignature === signature;
  }
}

export default RazorpayWrapper;

interface WebhookEventVerifyRequest {
  body: string;
  signature: string;
}

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
