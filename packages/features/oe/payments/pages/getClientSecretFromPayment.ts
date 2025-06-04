import type { Payment } from "@calcom/prisma/client";

const validateObjectProperty = <K extends string>(
  target: unknown,
  propertyKey: K
): target is { [key in K]: string } => {
  return Boolean(target && typeof target === "object" && propertyKey in target);
};

const extractSetupIntentSecret = (transactionData: Record<string, unknown>): string => {
  if (!validateObjectProperty(transactionData, "setupIntent")) {
    return "";
  }

  const setupIntentData = transactionData.setupIntent;
  return validateObjectProperty(setupIntentData, "client_secret") ? setupIntentData.client_secret : "";
};

const extractDirectSecret = (transactionData: Record<string, unknown>): string => {
  return validateObjectProperty(transactionData, "client_secret") ? transactionData.client_secret : "";
};

const isHoldPaymentType = (paymentOption: unknown): boolean => {
  return paymentOption === "HOLD";
};

export function getClientSecretFromPayment(
  payment: Omit<Partial<Payment>, "data"> & { data: Record<string, unknown> }
): string {
  const { paymentOption: transactionType, data: transactionPayload } = payment;

  if (isHoldPaymentType(transactionType)) {
    const holdSecret = extractSetupIntentSecret(transactionPayload);
    if (holdSecret) return holdSecret;
  }

  return extractDirectSecret(transactionPayload);
}
