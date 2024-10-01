import { z } from "zod";

export const ZGetAllInputSchema = z.object({
  filters: z.object({
    teamIds: z.number().array().optional(),
    userIds: z.number().array().optional(),
    eventTypeIds: z.number().array().optional(),
  }),
});

export type TGetAllInputSchema = z.infer<typeof ZGetAllInputSchema>;
