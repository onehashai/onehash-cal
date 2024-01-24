import { z } from "zod";

export const ZGetInputSchema = z.object({
  userId: z.union([z.number(), z.null()]),
});

export type TGetInputSchema = z.infer<typeof ZGetInputSchema>;
