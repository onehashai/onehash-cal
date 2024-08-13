import type { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import axios from "axios";
import crypto from "crypto";

import { isPrismaObjOrUndefined } from "@calcom/lib";
import {
  RAZORPAY_CLIENT_ID,
  RAZORPAY_CLIENT_SECRET,
  RAZORPAY_UPI_ENABLED,
  RAZORPAY_WEBHOOK_SECRET,
  WEBAPP_URL,
} from "@calcom/lib/constants";
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
  private isRefreshing = false;

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

      console.log("refreshAccessToken response", response.data);
      await this.handleUpdateToken(response.data);
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw new Error("Failed to refresh token");
    }
  }

  private async handleRequest<T>(request: () => Promise<AxiosResponse<T>>): Promise<T> {
    try {
      const response = await request();
      return response.data;
    } catch (error) {
      // Type assertion to AxiosError
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 401) {
        // Unauthorized
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            await this.refreshAccessToken();
            const retryResponse = await request();
            return retryResponse.data;
          } catch (refreshError) {
            console.error("Error refreshing token:", refreshError);
            throw refreshError;
          } finally {
            this.isRefreshing = false;
          }
        } else {
          return new Promise<T>((resolve, reject) => {
            const checkTokenRefresh = () => {
              if (!this.isRefreshing) {
                this.handleRequest(request).then(resolve).catch(reject);
              } else {
                setTimeout(checkTokenRefresh, 100);
              }
            };
            checkTokenRefresh();
          });
        }
      }

      console.error("Request failed:", axiosError);
      throw axiosError;
    }
  }

  async test(): Promise<boolean> {
    return this.handleRequest(() => this.axiosInstance.get("/payments"))
      .then(() => true)
      .catch(() => false);
  }

  // Payments

  async createPaymentLink({
    bookingUid,
    amount,
    currency,
    reference_id,
    customer,
  }: {
    bookingUid: string;
    amount: number;
    currency: string;
    reference_id: string;
    customer: {
      name: string;
      email: string;
    };
  }): Promise<CreatePaymentLinkResponse> {
    return this.handleRequest(() =>
      this.axiosInstance.post("/payment_links", {
        amount,
        currency,
        reference_id,
        customer,
        callback_url: `${WEBAPP_URL}/booking/${bookingUid}`,
        callback_method: "get",
        upi_link: RAZORPAY_UPI_ENABLED,
      })
    );
  }

  async initiateRefund(paymentId: string): Promise<boolean> {
    const response = await this.handleRequest(() => this.axiosInstance.post(`/payments/${paymentId}/refund`));
    return response.status === "processed";
  }

  async handleCancelPayment(paymentLinkId: string): Promise<boolean> {
    const response = await this.handleRequest(() =>
      this.axiosInstance.post(`/payment_links/${paymentLinkId}/cancel`)
    );
    return response.status === "cancelled";
  }

  // Webhook
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

interface CreatePaymentLinkResponse {
  id: string;
  reference_id: string;
  short_url: string;
  user_id: string;
  currency: string;
  amount: number;
  amount_paid: number;
}