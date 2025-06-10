import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import type { TGetAttendeesSchema } from "./getAttendees.schema";

type GetAttendeesOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TGetAttendeesSchema;
};

export const getAttendeesHandler = async ({ ctx, input }: GetAttendeesOptions) => {
  const { user } = ctx;

  const attendees = await prisma.attendee.findMany({
    where: {
      name: {
        contains: input.name,
        mode: "insensitive",
      },
      booking: {
        userId: user.id,
      },
    },
  });

  const uniqueAttendees = Array.from(
    new Map(attendees.map((attendee) => [attendee.name, attendee])).values()
  );

  return uniqueAttendees;
};
