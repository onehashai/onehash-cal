import crypto from "crypto";

import { RAZORPAY_CLIENT_SECRET } from "@calcom/lib/constants";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import prisma from "@calcom/prisma";

interface PaymentParams {
  razorpay_payment_id?: string;
  razorpay_payment_link_id?: string;
  razorpay_payment_link_reference_id?: string;
  razorpay_payment_link_status?: string;
  razorpay_signature?: string;
}

const validatePaymentRedirect = (params: PaymentParams, signature: string): boolean => {
  const {
    razorpay_payment_id,
    razorpay_payment_link_id,
    razorpay_payment_link_reference_id,
    razorpay_payment_link_status,
  } = params;

  if (
    !razorpay_payment_id ||
    !razorpay_payment_link_id ||
    !razorpay_payment_link_reference_id ||
    !razorpay_payment_link_status
  ) {
    return false;
  }

  const payload = `${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`;
  if (!RAZORPAY_CLIENT_SECRET || typeof RAZORPAY_CLIENT_SECRET !== "string") return false;
  const expectedSignature = crypto.createHmac("sha256", RAZORPAY_CLIENT_SECRET).update(payload).digest("hex");

  return expectedSignature === signature;
};

const handleRazorpayPaymentRedirect = async (params: PaymentParams): Promise<string> => {
  const {
    razorpay_payment_id,
    razorpay_payment_link_id,
    razorpay_signature,
    razorpay_payment_link_status,
    razorpay_payment_link_reference_id,
  } = params;

  if (
    !razorpay_payment_id ||
    !razorpay_payment_link_id ||
    !razorpay_signature ||
    !razorpay_payment_link_status ||
    !razorpay_payment_link_reference_id
  ) {
    return "error";
  }

  try {
    if (!validatePaymentRedirect(params, razorpay_signature)) {
      console.error("Payment verification failed");
      return "error";
    }
    if (razorpay_payment_link_status !== "paid") {
      console.log("Payment not made");
      return "failed";
    }

    const payment = await prisma.payment.findUnique({
      where: { externalId: razorpay_payment_link_id },
      select: { id: true, bookingId: true },
    });

    if (!payment) {
      return "error";
    }

    await handlePaymentSuccess(payment.id, payment.bookingId, { paymentId: razorpay_payment_id });
    return "success";
  } catch (e) {
    console.error("Error handling payment success redirect:", e);
    return "error";
  }
};

export default handleRazorpayPaymentRedirect;
