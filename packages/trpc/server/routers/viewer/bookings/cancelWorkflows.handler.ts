import { cancelWorkflowReminders } from "@calcom/features/ee/workflows/lib/reminders/reminderScheduler";

import { TRPCError } from "@trpc/server";

import type { TCancelScheduledWorkflowsSchema } from "./cancelWorkflows.schema";

type CancelScheduledWorkflowsOptions = {
  input: TCancelScheduledWorkflowsSchema;
};

export const cancelWorkflowHandler = async ({ input }: CancelScheduledWorkflowsOptions) => {
  try {
    await cancelWorkflowReminders(input.workflows);
    return { message: "Scheduled workflows cancelled" };
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }
};
