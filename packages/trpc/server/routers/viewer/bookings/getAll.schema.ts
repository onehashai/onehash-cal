import { z } from "zod";

export const ZGetAllInputSchema = z.object({
  filters: z.object({
    teamIds: z.number().array().optional(),
    userIds: z.number().array().optional(),
    eventTypeIds: z.number().array().optional(),
    attendees: z.string().array().optional(),
    afterStartDate: z.string().optional(),
    beforeEndDate: z.string().optional(),
  }),
});

export type TGetAllInputSchema = z.infer<typeof ZGetAllInputSchema>;
