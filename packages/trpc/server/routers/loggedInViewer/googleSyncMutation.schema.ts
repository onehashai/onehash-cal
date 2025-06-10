import { z } from "zod";

export const ZGoogleSyncMutationInputSchema = z.object({
  integration: z.string().optional(),
  externalId: z.string(),
  googleSyncEnabled: z.boolean(),
});

export type TGoogleSyncMutationInputSchema = z.infer<typeof ZGoogleSyncMutationInputSchema>;
