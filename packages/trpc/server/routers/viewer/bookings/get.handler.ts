import { Prisma as PrismaClientType } from "@prisma/client";
import { RRule, RRuleSet, rrulestr } from "rrule";

import { parseRecurringEvent, parseEventTypeColor, isPrismaObjOrUndefined } from "@calcom/lib";
import getAllUserBookings from "@calcom/lib/bookings/getAllUserBookings";
import type { PrismaClient } from "@calcom/prisma";
import { bookingMinimalSelect } from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { MembershipRole, type BookingStatus } from "@calcom/prisma/enums";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";

import type { TrpcSessionUser } from "../../../trpc";
import type { TGetInputSchema } from "./get.schema";

type GetOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    prisma: PrismaClient;
  };
  input: TGetInputSchema;
};

export const getHandler = async ({ ctx, input }: GetOptions) => {
  // using offset actually because cursor pagination requires a unique column
  // for orderBy, but we don't use a unique column in our orderBy
  const take = input.limit ?? 10;
  const skip = input.cursor ?? 0;
  const { prisma, user } = ctx;
  const defaultStatus = "upcoming";
  const bookingListingByStatus = [input.filters.status || defaultStatus];
  const teamMember = input.teamMember;

  const _user = teamMember || { id: user.id, email: user.email };

  const { bookings, recurringInfo, nextCursor } = await getAllUserBookings({
    ctx: {
      user: _user,
      prisma: prisma,
    },
    bookingListingByStatus: bookingListingByStatus,
    take: take,
    skip: skip,
    filters: input.filters,
  });

  return {
    bookings,
    recurringInfo,
    nextCursor,
  };
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

// returns recurrence dates and count for google calendar events with recurrence pattern as per "RFC5545"
function generateDatesFromRecurrence({
  recurrencePattern,
  startTime,
}: {
  recurrencePattern: {
    RRULE?: string;
    EXRULE?: string;
    RDATE?: string;
    EXDATE?: string;
  };
  startTime: Date;
}): { dates: Date[]; count: number } {
  const ruleSet = new RRuleSet();
  const MAX_OCCURRENCES = 730;

  if (recurrencePattern.RRULE) {
    let rule = rrulestr(recurrencePattern.RRULE, { dtstart: startTime });

    if (!rule.options.until && !rule.options.count) {
      rule = new RRule({ ...rule.options, count: MAX_OCCURRENCES });
    }

    ruleSet.rrule(rule);
  }

  if (recurrencePattern.EXRULE) {
    let exRule = rrulestr(recurrencePattern.EXRULE, { dtstart: startTime });

    if (!exRule.options.until && !exRule.options.count) {
      exRule = new RRule({ ...exRule.options, count: MAX_OCCURRENCES });
    }

    ruleSet.exrule(exRule);
  }

  if (recurrencePattern.RDATE) {
    recurrencePattern.RDATE.split(",").forEach((date) => ruleSet.rdate(new Date(date)));
  }

  if (recurrencePattern.EXDATE) {
    recurrencePattern.EXDATE.split(",").forEach((date) => ruleSet.exdate(new Date(date)));
  }

  const occurrences = ruleSet.all();
  return { dates: occurrences, count: occurrences.length };
}

//to retrieve metadata from grouped events
async function getMetadatafromGroupedEvent(
  prisma: PrismaClient,
  recurringInfoExtended: {
    recurringEventId: string | null;
    status: BookingStatus;
    startTime: Date;
  }[]
) {
  const metadataRecords = await prisma.booking.findMany({
    where: {
      recurringEventId: {
        in: recurringInfoExtended.map((b) => b.recurringEventId).filter((id): id is string => id !== null),
      },
    },
    select: { recurringEventId: true, metadata: true },
  });

  const metadataMap: Record<string, Prisma.JsonValue> = Object.fromEntries(
    metadataRecords.map((record) => [record.recurringEventId, record.metadata])
  );

  const recurringInfoExtendedWithMeta = recurringInfoExtended.map((group) => ({
    ...group,
    metadata: metadataMap[group.recurringEventId ?? ""],
  }));
  return recurringInfoExtendedWithMeta;
}

export async function getBookings({
  user,
  prisma,
  passedBookingsStatusFilter,
  filters,
  orderBy,
  take,
  skip,
}: {
  user: { id: number; email: string };
  filters: TGetInputSchema["filters"];
  prisma: PrismaClient;
  passedBookingsStatusFilter: Prisma.BookingWhereInput;
  orderBy: Prisma.BookingOrderByWithAggregationInput;
  take: number;
  skip: number;
}) {
  const bookingWhereInputFilters: Record<string, Prisma.BookingWhereInput> = {};

  if (filters?.teamIds && filters.teamIds.length > 0) {
    bookingWhereInputFilters.teamIds = {
      AND: [
        {
          OR: [
            {
              eventType: {
                team: {
                  id: {
                    in: filters.teamIds,
                  },
                },
              },
            },
            {
              eventType: {
                parent: {
                  team: {
                    id: {
                      in: filters.teamIds,
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    bookingWhereInputFilters.userIds = {
      AND: [
        {
          OR: [
            {
              eventType: {
                hosts: {
                  some: {
                    userId: {
                      in: filters.userIds,
                    },
                    isFixed: true,
                  },
                },
              },
            },
            {
              userId: {
                in: filters.userIds,
              },
            },
            {
              eventType: {
                users: {
                  some: {
                    id: {
                      in: filters.userIds,
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  if (filters?.eventTypeIds && filters.eventTypeIds.length > 0) {
    bookingWhereInputFilters.eventTypeIds = {
      AND: [
        {
          OR: [
            {
              eventTypeId: {
                in: filters.eventTypeIds,
              },
            },
            {
              eventType: {
                parent: {
                  id: {
                    in: filters.eventTypeIds,
                  },
                },
              },
            },
          ],
        },
      ],
    };
  }

  if (filters?.attendeeEmail) {
    bookingWhereInputFilters.attendeeEmail = {
      attendees: {
        some: {
          email: filters.attendeeEmail.trim(),
        },
      },
    };
  }

  if (filters?.attendeeName) {
    bookingWhereInputFilters.attendeeName = {
      attendees: {
        some: {
          name: filters.attendeeName.trim(),
        },
      },
    };
  }

  if (filters?.attendees) {
    bookingWhereInputFilters.attendees = {
      attendees: {
        some: {
          name: {
            in: filters?.attendees,
          },
        },
      },
    };
  }

  if (filters?.afterStartDate) {
    bookingWhereInputFilters.afterStartDate = {
      startTime: {
        gte: new Date(filters.afterStartDate),
      },
    };
  }

  if (filters?.beforeEndDate) {
    bookingWhereInputFilters.beforeEndDate = {
      endTime: {
        lte: new Date(filters.beforeEndDate),
      },
    };
  }

  const filtersCombined: Prisma.BookingWhereInput[] = !filters
    ? []
    : Object.keys(filters)
        .map((key) => bookingWhereInputFilters[key])
        // On prisma 5.4.2 passing undefined to where "AND" causes an error
        .filter(Boolean);

  const bookingSelect = {
    ...bookingMinimalSelect,
    uid: true,
    responses: true,
    /**
     * Who uses it -
     * 1. We need to be able to decide which booking can have a 'Reroute' action
     */
    routedFromRoutingFormReponse: {
      select: {
        id: true,
      },
    },
    recurringEventId: true,
    location: true,
    eventType: {
      select: {
        slug: true,
        id: true,
        title: true,
        eventName: true,
        price: true,
        recurringEvent: true,
        currency: true,
        metadata: true,
        seatsShowAttendees: true,
        seatsShowAvailabilityCount: true,
        eventTypeColor: true,
        schedulingType: true,
        length: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            members: true,
          },
        },
        bookingFields: true,
      },
    },
    status: true,
    paid: true,
    payment: {
      select: {
        paymentOption: true,
        amount: true,
        currency: true,
        success: true,
      },
    },
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
      },
    },
    rescheduled: true,
    references: true,
    isRecorded: true,
    seatsReferences: {
      where: {
        attendee: {
          email: user.email,
        },
      },
      select: {
        referenceUid: true,
        attendee: {
          select: {
            email: true,
          },
        },
      },
    },
    cancellationReason: true,
    assignmentReason: {
      orderBy: { createdAt: PrismaClientType.SortOrder.desc },
      take: 1,
    },
  };
  const [
    // Quering these in parallel to save time.
    // Note that because we are applying `take` to individual queries, we will usually get more bookings then we need. It is okay to have more bookings faster than having what we need slower
    bookingsQueryUserId,
    bookingsQueryAttendees,
    bookingsQueryTeamMember,
    bookingsQueryOrganizationMembers,
    bookingsQuerySeatReference,
    //////////////////////////

    recurringInfoBasic,
    recurringInfoExtended,
    // We need all promises to be successful, so we are not using Promise.allSettled
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        OR: [
          {
            userId: user.id,
          },
        ],
        AND: [passedBookingsStatusFilter, ...filtersCombined],
      },
      orderBy,
      take: take + 1,
      skip,
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
        AND: [passedBookingsStatusFilter, ...filtersCombined],
      },
      orderBy,
      take: take + 1,
      skip,
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
        AND: [passedBookingsStatusFilter, ...filtersCombined],
      },
      orderBy,
      take: take + 1,
      skip,
    }),
    prisma.booking.findMany({
      where: {
        OR: [
          {
            user: {
              teams: {
                some: {
                  team: {
                    isOrganization: true,
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
            },
          },
        ],
        AND: [passedBookingsStatusFilter, ...filtersCombined],
      },
      orderBy,
      take: take + 1,
      skip,
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
        AND: [passedBookingsStatusFilter, ...filtersCombined],
      },
      orderBy,
      take: take + 1,
      skip,
    }),
    //recurringInfoBasic
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
    //recurringInfoExtended
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

  // Fetch metadata separately
  const recurringInfoExtendedWithMeta = await getMetadatafromGroupedEvent(prisma, recurringInfoExtended);

  const allOccurrences = recurringInfoExtendedWithMeta.flatMap((it, index) => {
    //Try different patterns for testing
    // const recurrenctPattern =
    //   index == 1
    //     ? {
    //         RRULE: "FREQ=DAILY;UNTIL=20250830T235959Z",
    //         RDATE: "2025-04-18T03:30:00Z,2025-04-22T03:30:00Z",
    //         EXDATE: "2025-04-19T03:30:00Z,2025-05-01T03:30:00Z",
    //       }
    //     : isPrismaObjOrUndefined(it.metadata)?.recurrencePattern;

    const recurrenctPattern = isPrismaObjOrUndefined(
      isPrismaObjOrUndefined(it.metadata)?.recurrencePattern
    )?.recurrencePattern;
    if (!recurrenctPattern) {
      return [{ ...it, count: 1 }];
    }

    const { dates, count } = generateDatesFromRecurrence({
      recurrencePattern: recurrenctPattern as PrismaClientType.JsonObject,
      startTime: it.startTime,
    });

    return dates.map((date) => ({
      recurringEventId: it.recurringEventId,
      status: it.status,
      startTime: date,
      count,
    }));
  });

  // Precompute bookings organized by status

  const { googleRecurringEventSet, googleEventCountMap, recurringEvtStatusMap } =
    getGCalBookingsRecurringInfo(recurringInfoExtendedWithMeta, allOccurrences);

  const recurringInfo = recurringInfoBasic.map(
    (
      info: (typeof recurringInfoBasic)[number]
    ): {
      recurringEventId: string | null;
      count: number;
      firstDate: Date | null;
      bookings: {
        [key: string]: Date[];
      };
    } => {
      const isGoogleCalendarRecurringEvt = googleRecurringEventSet.has(info.recurringEventId);

      const count = isGoogleCalendarRecurringEvt
        ? googleEventCountMap.get(info.recurringEventId ?? "") ?? 730
        : info._count.recurringEventId;
      // const bookings = recurringInfoExtended.reduce(
      //   (prev, curr) => {
      //     if (curr.recurringEventId === info.recurringEventId) {
      //       prev[curr.status].push(curr.startTime);
      //     }
      //     return prev;
      //   },
      //   { ACCEPTED: [], CANCELLED: [], REJECTED: [], PENDING: [], AWAITING_HOST: [] } as {
      //     [key in BookingStatus]: Date[];
      //   }
      // );
      return {
        recurringEventId: info.recurringEventId,
        count: count,
        firstDate: info._min.startTime,
        bookings: recurringEvtStatusMap.get(info.recurringEventId ?? "") ?? {
          ACCEPTED: [],
          CANCELLED: [],
          REJECTED: [],
          PENDING: [],
          AWAITING_HOST: [],
        },
      };
    }
  );

  const plainBookings = getUniqueBookings(
    // It's going to mess up the orderBy as we are concatenating independent queries results
    bookingsQueryUserId
      .concat(bookingsQueryAttendees)
      .concat(bookingsQueryTeamMember)
      .concat(bookingsQueryOrganizationMembers)
      .concat(bookingsQuerySeatReference)
  );

  // Now enrich bookings with relation data. We could have queried the relation data along with the bookings, but that would cause unnecessary queries to the database.
  // Because Prisma is also going to query the select relation data sequentially, we are fine querying it separately here as it would be just 1 query instead of 4

  //External recurring booking single event handling
  const bookings = await Promise.all(
    (
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
    )
      //FILTER BLOCK TO HANDLE EXTERNAL RECURRING EVENTS
      .filter((booking) => {
        const metadata = isPrismaObjOrUndefined(booking.metadata);
        if (!metadata?.isExternalEvent) return true;

        const _r = recurringInfo.find((info) => info.recurringEventId === booking.recurringEventId);
        return !_r || hasUpcomingDate(_r.bookings.ACCEPTED);
      })
      .map(async (booking) => {
        // If seats are enabled and the event is not set to show attendees, filter out attendees that are not the current user
        if (booking.seatsReferences.length && !booking.eventType?.seatsShowAttendees) {
          booking.attendees = booking.attendees.filter((attendee) => attendee.email === user.email);
        }

        const membership = booking.eventType?.team?.members.find(
          (membership) => membership.userId === user.id
        );
        const isUserTeamAdminOrOwner =
          membership?.role === MembershipRole.OWNER || membership?.role === MembershipRole.ADMIN;

        return {
          ...booking,
          eventType: {
            ...booking.eventType,
            recurringEvent: parseRecurringEvent(booking.eventType?.recurringEvent),
            eventTypeColor: parseEventTypeColor(booking.eventType?.eventTypeColor),
            price: booking.eventType?.price || 0,
            currency: booking.eventType?.currency || "usd",
            metadata: EventTypeMetaDataSchema.parse(booking.eventType?.metadata || {}),
          },
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          isUserTeamAdminOrOwner,
        };
      })
  );
  return { bookings, recurringInfo };
}
function getGCalBookingsRecurringInfo(
  recurringInfoExtendedWithMeta: {
    metadata: PrismaClientType.JsonValue;
    recurringEventId: string | null;
    status: BookingStatus;
    startTime: Date;
  }[],
  allOccurrences: { recurringEventId: string | null; status: BookingStatus; startTime: Date; count: number }[]
) {
  const googleRecurringEventSet = new Set(
    recurringInfoExtendedWithMeta
      .filter((b) => isPrismaObjOrUndefined(b.metadata)?.recurrencePattern)
      .map((b) => b.recurringEventId)
  );
  const googleEventCountMap = new Map<string, number>();
  const recurringEvtStatusMap = new Map<
    string,
    {
      [key in BookingStatus]: Date[];
    }
  >();

  allOccurrences.forEach((curr) => {
    if (!curr.recurringEventId) return;

    googleEventCountMap.set(curr.recurringEventId, curr.count);

    if (!recurringEvtStatusMap.has(curr.recurringEventId)) {
      recurringEvtStatusMap.set(curr.recurringEventId, {
        ACCEPTED: [],
        CANCELLED: [],
        REJECTED: [],
        PENDING: [],
        AWAITING_HOST: [],
      });
    } else {
      const statusEntry = recurringEvtStatusMap.get(curr.recurringEventId);
      if (statusEntry) {
        statusEntry[curr.status].push(curr.startTime);
      }
    }
  });
  return { googleRecurringEventSet, googleEventCountMap, recurringEvtStatusMap };
}

function hasUpcomingDate(dates: Date[]) {
  const currentTime = new Date();
  let left = 0,
    right = dates.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (dates[mid] >= currentTime) {
      // If this is the first valid date, return true
      if (mid === 0 || dates[mid - 1] < currentTime) return true;
      right = mid - 1; // Move left
    } else {
      left = mid + 1; // Move right
    }
  }

  return false; // No valid date found
}
