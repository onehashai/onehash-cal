import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import type { TGoogleSyncMutationInputSchema } from "./googleSyncMutation.schema";

type GoogleSyncMutationOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TGoogleSyncMutationInputSchema;
};

export const googleSyncMutationHandler = async ({ ctx, input }: GoogleSyncMutationOptions) => {
  const { integration, externalId, googleSyncEnabled } = input;
  if (!integration) {
    throw new Error("Integration is required");
  }
  const res = await prisma.selectedCalendar.update({
    where: {
      userId_integration_externalId: {
        userId: ctx.user.id,
        integration,
        externalId,
      },
    },
    data: {
      googleSyncEnabled,
    },
  });

  return res;
};
