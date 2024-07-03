import { z } from "zod";

import type { UpdateAppCredentialsOptions } from "@calcom/trpc/server/routers/viewer/apps/updateAppCredentials.handler";

import { default as Razorpay } from "./Razorpay";

const schema = z.object({
  credentialId: z.coerce.number(),
  key: z.object({
    key_id: z.string(),
    key_secret: z.string(),
    merchant_id: z.string(),
  }),
});

const handleRazorpayValidations = async ({ input }: UpdateAppCredentialsOptions) => {
  const validated = schema.safeParse(input);
  if (!validated.success) throw new Error("Invalid input");
  const { key } = validated.data;

  // Test credentials before saving
  const razorpayClient = new Razorpay({
    keyId: key.key_id,
    keySecret: key.key_secret,
    merchantId: key.merchant_id,
  });
  const test = await razorpayClient.test();
  if (!test) throw new Error("Provided credentials failed to authenticate");

  // Delete all existing webhooks
  const webhooksToDelete = await razorpayClient.listWebhooks();
  if (webhooksToDelete) {
    const promises = webhooksToDelete.map((webhook) =>
      razorpayClient.deleteWebhook({
        webhookId: webhook,
      })
    );
    await Promise.all(promises);
  }

  // Create webhook for this installation
  const webhookId = await razorpayClient.createWebhook();
  if (!webhookId) {
    // @TODO: make a button that tries to create the webhook again
    console.error("Failed to create webhook", webhookId);
    throw new Error("Failed to create webhook");
  }

  return {
    client_id: key.key_id,
    secret_key: key.key_secret,
    webhook_id: webhookId,
    merchant_id: key.merchant_id,
  };
};

export default handleRazorpayValidations;
