import { z } from "zod";

import { WorkflowMethods } from "@calcom/prisma/client";

const WorkflowMethodsEnum = z.union([
  z.literal(WorkflowMethods.EMAIL),
  z.literal(WorkflowMethods.SMS),
  z.literal(WorkflowMethods.WHATSAPP),
]);

export const ZCancelScheduledWorkflowsInputSchema = z.object({
  workflows: z.array(
    z.object({
      id: z.number(),
      referenceId: z.string().nullable(),
      method: WorkflowMethodsEnum,
    })
  ),
});
export type TCancelScheduledWorkflowsSchema = z.infer<typeof ZCancelScheduledWorkflowsInputSchema>;
