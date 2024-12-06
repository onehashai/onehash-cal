import type { PrismaClient } from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";

import type { TGetAllInputSchema } from "./getAll.schema";

type GetAllOptions = {
  ctx: {
    user: { id: number; email: string };
    prisma: PrismaClient;
  };
  input: TGetAllInputSchema;
};

export const getAllHandler = async ({ ctx, input }: GetAllOptions) => {
  // using offset actually because cursor pagination requires a unique column
  // for orderBy, but we don't use a unique column in our orderBy
  const { prisma, user } = ctx;

  const bookings = await getAllUserBookings({
    ctx: { user: { id: user.id, email: user.email }, prisma: prisma },
    input: {
      filters: input.filters,
    },
  });

  return bookings;
};

const getAllUserBookings = async ({ ctx, input }: GetAllOptions) => {
  const { prisma, user } = ctx;

  const orderBy = { startTime: Prisma.SortOrder.asc };

  const bookings = await getAllBookings({
    user,
    prisma,
    filters: input.filters,
    orderBy,
  });

  return bookings;
};

const set = new Set();
const getUniqueBookings = <T extends { uid: string }>(arr: T[]) => {
  const unique = arr.filter((booking) => {
    const duplicate = set.has(booking.uid);
    set.add(booking.uid);
    return !duplicate;
  });
  set.clear();
  return unique;
};

export async function getAllBookings({
  user,
  prisma,
  filters,
  orderBy,
}: {
  user: { id: number; email: string };
  filters: TGetAllInputSchema["filters"];
  prisma: PrismaClient;
  orderBy: Prisma.BookingOrderByWithAggregationInput;
}) {
  // TODO: Fix record typing
  const bookingWhereInputFilters: Record<string, Prisma.BookingWhereInput> = {
    teamIds: {
      AND: [
        {
          eventType: {
            team: {
              id: {
                in: filters?.teamIds,
              },
            },
          },
        },
      ],
    },
    userIds: {
      AND: [
        {
          OR: [
            {
              eventType: {
                hosts: {
                  some: {
                    userId: {
                      in: filters?.userIds,
                    },
                  },
                },
              },
            },
            {
              userId: {
                in: filters?.userIds,
              },
            },
            {
              eventType: {
                users: {
                  some: {
                    id: {
                      in: filters?.userIds,
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    eventTypeIds: {
      AND: [
        {
          eventTypeId: {
            in: filters?.eventTypeIds,
          },
        },
      ],
    },
    attendees: {
      AND: [
        {
          attendees: {
            some: {
              name: {
                in: filters?.attendees,
              },
            },
          },
        },
      ],
    },
    afterStartDate: {
      AND: [
        {
          startTime: {
            gte: new Date(filters.afterStartDate),
          },
        },
      ],
    },
    beforeEndDate: {
      AND: [
        {
          endTime: {
            lte: new Date(filters.beforeEndDate),
          },
        },
      ],
    },
  };

  const filtersCombined: Prisma.BookingWhereInput[] = !filters
    ? []
    : Object.keys(filters)
        .map((key) => bookingWhereInputFilters[key])
        // On prisma 5.4.2 passing undefined to where "AND" causes an error
        .filter(Boolean);

  const bookingSelect = {
    id: true,
    title: true,
    userPrimaryEmail: true,
    description: true,
    customInputs: true,
    startTime: true,
    endTime: true,
    metadata: true,
    status: true,
    recurringEventId: true,
    location: true,
    paid: true,
    rescheduled: true,
    isRecorded: true,
    attendees: {
      select: {
        email: true,
      },
    },
    payment: {
      select: {
        paymentOption: true,
        amount: true,
        currency: true,
        success: true,
      },
    },
    eventType: {
      select: {
        title: true,
      },
    },
  };

  const [
    // Quering these in parallel to save time.
    // Note that because we are applying `take` to individual queries, we will usually get more bookings then we need. It is okay to have more bookings faster than having what we need slower
    bookingsQueryUserId,
    bookingsQueryAttendees,
    bookingsQueryTeamMember,
    bookingsQuerySeatReference,
    //////////////////////////

    // We need all promises to be successful, so we are not using Promise.allSettled
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        OR: [
          {
            userId: user.id,
          },
        ],
        AND: [...filtersCombined],
      },
      orderBy,
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          {
            attendees: {
              some: {
                email: user.email,
              },
            },
          },
        ],
        AND: [...filtersCombined],
      },
      orderBy,
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          {
            eventType: {
              team: {
                members: {
                  some: {
                    userId: user.id,
                    role: {
                      in: ["ADMIN", "OWNER"],
                    },
                  },
                },
              },
            },
          },
        ],
        AND: [...filtersCombined],
      },
      orderBy,
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          {
            seatsReferences: {
              some: {
                attendee: {
                  email: user.email,
                },
              },
            },
          },
        ],
        AND: [...filtersCombined],
      },
      orderBy,
    }),
    prisma.booking.groupBy({
      by: ["recurringEventId"],
      _min: {
        startTime: true,
      },
      _count: {
        recurringEventId: true,
      },
      where: {
        recurringEventId: {
          not: { equals: null },
        },
        userId: user.id,
      },
    }),
    prisma.booking.groupBy({
      by: ["recurringEventId", "status", "startTime"],
      _min: {
        startTime: true,
      },
      where: {
        recurringEventId: {
          not: { equals: null },
        },
        userId: user.id,
      },
    }),
  ]);

  const plainBookings = getUniqueBookings(
    // It's going to mess up the orderBy as we are concatenating independent queries results
    bookingsQueryUserId
      .concat(bookingsQueryAttendees)
      .concat(bookingsQueryTeamMember)
      .concat(bookingsQuerySeatReference)
  );

  // Now enrich bookings with relation data. We could have queried the relation data along with the bookings, but that would cause unnecessary queries to the database.
  // Because Prisma is also going to query the select relation data sequentially, we are fine querying it separately here as it would be just 1 query instead of 4
  const bookings = (
    await prisma.booking.findMany({
      where: {
        id: {
          in: plainBookings.map((booking) => booking.id),
        },
      },
      select: bookingSelect,
      // We need to get the sorted bookings here as well because plainBookings array is not correctly sorted
      orderBy,
    })
  ).map((booking) => {
    return {
      ...booking,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    };
  });

  return bookings;
}
