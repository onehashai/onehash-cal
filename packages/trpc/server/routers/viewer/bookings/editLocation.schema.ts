import { z } from "zod";

//CHANGE:JITSI
// import { DailyLocationType } from "@calcom/app-store/locations";
import { JitsiLocationType } from "@calcom/app-store/locations";

import { commonBookingSchema } from "./types";

//CHANGE:JITSI
// export const ZEditLocationInputSchema = commonBookingSchema.extend({
//   newLocation: z.string().transform((val) => val || DailyLocationType),
//   details: z.object({ credentialId: z.number().optional() }).optional(),
// });

export const ZEditLocationInputSchema = commonBookingSchema.extend({
  newLocation: z.string().transform((val) => val || JitsiLocationType),
  credentialId: z.number().nullable(),
});

export type TEditLocationInputSchema = z.infer<typeof ZEditLocationInputSchema>;
