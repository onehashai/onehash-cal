import { z } from "zod";

export const ZUpdateInputSchema = z.object({
  encodedRawMetadata: z.string(),
  userId: z.union([z.number(), z.null()]),
});

export type TUpdateInputSchema = z.infer<typeof ZUpdateInputSchema>;
