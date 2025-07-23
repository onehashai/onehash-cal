import {
  TIME_UNITS,
  WORKFLOW_ACTIONS,
  WORKFLOW_TEMPLATES,
  WORKFLOW_TRIGGER_EVENTS,
} from "@onehash/oe-features/workflows/config/constants";
import { z } from "zod";

export const ZUpdateInputSchema = z.object({
  id: z.number(),
  name: z.string(),
  activeOn: z.number().array(),
  steps: z
    .object({
      id: z.number(),
      stepNumber: z.number(),
      action: z.enum(WORKFLOW_ACTIONS),
      workflowId: z.number(),
      sendTo: z
        .string()
        .nullable()
        .optional()
        .transform((val) => val ?? null),
      // sendTo: z.string().nullable(),
      reminderBody: z.string().nullable(),
      emailSubject: z.string().nullable(),
      template: z.enum(WORKFLOW_TEMPLATES),
      numberRequired: z.boolean().nullable(),
      sender: z.string().nullable(),
      senderName: z.string().nullable(),
      includeCalendarEvent: z.boolean(),
      disableOnMarkNoShow: z
        .boolean()
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    })
    .array(),
  trigger: z.enum(WORKFLOW_TRIGGER_EVENTS),
  time: z.number().nullable(),
  timeUnit: z.enum(TIME_UNITS).nullable(),
  isActiveOnAll: z.boolean().optional(),
});

export type TUpdateInputSchema = z.infer<typeof ZUpdateInputSchema>;
