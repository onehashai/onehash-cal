import { z } from "zod";

export const ZDeleteInputSchema = z.object({
  userId: z.union([z.number(), z.null()]),
});

export type TDeleteInputSchema = z.infer<typeof ZDeleteInputSchema>;
