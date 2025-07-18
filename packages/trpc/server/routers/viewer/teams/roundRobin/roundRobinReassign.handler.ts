import type { ReassignmentResult } from "@calcom/features/ee/round-robin/roundRobinReassignment";
import { roundRobinReassignment } from "@calcom/features/ee/round-robin/roundRobinReassignment";
import { BookingRepository } from "@calcom/lib/server/repository/booking";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import { TRPCError } from "@trpc/server";

import type { TRoundRobinReassignInputSchema } from "./roundRobinReassign.schema";

type RoundRobinReassignOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TRoundRobinReassignInputSchema;
};

export const roundRobinReassignHandler = async ({
  ctx,
  input,
}: RoundRobinReassignOptions): Promise<ReassignmentResult> => {
  const { bookingId } = input;

  // Check if user has access to change booking
  const isAllowed = await BookingRepository.doesUserIdHaveAccessToBooking({ userId: ctx.user.id, bookingId });

  if (!isAllowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission" });
  }

  return await roundRobinReassignment({ bookingId, orgId: ctx.user.organizationId });
};

export default roundRobinReassignHandler;
