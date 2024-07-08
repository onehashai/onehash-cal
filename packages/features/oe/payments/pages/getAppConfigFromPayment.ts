import type { Payment } from "@calcom/prisma/client";

function hasStringProp<T extends string>(x: unknown, key: T): x is { [key in T]: string } {
  return !!x && typeof x === "object" && key in x;
}

export function getAppConfigFromPayment(
  payment: Omit<Partial<Payment>, "data"> & { data: Record<string, unknown> }
) {
  const config = {
    key_id: "",
    key_secret: "",
  };
  if (
    payment.paymentOption === "HOLD" &&
    hasStringProp(payment.data, "setupIntent") &&
    hasStringProp(payment.data.setupIntent, "client_secret")
  ) {
    config.key_secret = payment.data.setupIntent.client_secret;
  }
  if (hasStringProp(payment.data, "client_secret")) {
    config.key_secret = payment.data.client_secret;
  }
  if (hasStringProp(payment.data, "key_id")) {
    config.key_id = payment.data.key_id;
  }
  return config;
}
