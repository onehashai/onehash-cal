import { z } from "zod";

export const ZTeamsAndUserProfilesQueryInputSchema = z
  .object({
    includeOrg: z.boolean().optional(),
    includeTeams: z.boolean().default(true),
  })
  .optional();

export type TTeamsAndUserProfilesQueryInputSchema = z.infer<typeof ZTeamsAndUserProfilesQueryInputSchema>;
