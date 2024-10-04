import { WorkflowRepository } from "@calcom/lib/server/repository/workflow";

import type { TCancelScheduledWorkflowsSchema } from "./cancelWorkflows.schema";

type CancelScheduledWorkflowsOptions = {
  input: TCancelScheduledWorkflowsSchema;
};

export const cancelWorkflowHandler = async ({ input }: CancelScheduledWorkflowsOptions) => {
  try {
    await WorkflowRepository.deleteAllWorkflowReminders(input.workflows);
    return { message: "Scheduled workflows cancelled" };
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }
};
