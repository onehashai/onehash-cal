import { z } from "zod";

import { TIME_UNIT } from "@calcom/features/oe/workflows/lib/constants";
import { WEBHOOK_TRIGGER_EVENTS } from "@calcom/features/webhooks/lib/constants";

import { webhookIdAndEventTypeIdSchema } from "./types";

export const ZCreateInputSchema = webhookIdAndEventTypeIdSchema.extend({
  subscriberUrl: z.string().url(),
  eventTriggers: z.enum(WEBHOOK_TRIGGER_EVENTS).array(),
  active: z.boolean(),
  payloadTemplate: z.string().nullable(),
  eventTypeId: z.number().optional(),
  appId: z.string().optional().nullable(),
  secret: z.string().optional().nullable(),
  teamId: z.number().optional(),
  platform: z.boolean().optional(),
  time: z.number().nullable().optional(),
  timeUnit: z.enum(TIME_UNIT).nullable().optional(),
});

export type TCreateInputSchema = z.infer<typeof ZCreateInputSchema>;
