import { z } from "zod";

export const ZGetAttendeesSchema = z.object({
  name: z.string(),
});

export type TGetAttendeesSchema = z.infer<typeof ZGetAttendeesSchema>;
