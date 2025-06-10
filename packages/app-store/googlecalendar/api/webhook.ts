import type { calendar_v3 } from "@googleapis/calendar";
// eslint-disable-next-line no-restricted-imports
import isEqual from "lodash/isEqual";
import type { NextApiRequest, NextApiResponse } from "next";
import short from "short-uuid";

import dayjs from "@calcom/dayjs";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { defaultHandler } from "@calcom/lib/server";
import type { SelectedCalendarRepository } from "@calcom/lib/server/repository/selectedCalendar";
import { getServerTimezone } from "@calcom/lib/timezone";
import prisma from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";
import { BookingStatus } from "@calcom/prisma/enums";

import { MeetLocationType } from "../../locations";
import { ZoomLocationType } from "./../../locations";
import type { GoogleCalendarServiceType } from "./../lib/CalendarService";

const log = logger.getSubLogger({ prefix: ["api/integrations/googlecalendar/webhook"] });
type FindByGoogleChannelIdReturnType = Awaited<
  ReturnType<typeof SelectedCalendarRepository.findByGoogleChannelId>
>;
type CredentialType = NonNullable<FindByGoogleChannelIdReturnType>["credential"];
export type ExistingBookingType = Prisma.BookingGetPayload<{
  select: {
    attendees: true;
    uid: true;
    id: true;
    title: true;
    description: true;
    startTime: true;
    endTime: true;
    location: true;
    metadata: true;
    iCalUID: true;
    recurringEventId: true;
    responses: true;
  };
}>;
async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({
    message: `Temporarily disabled`,
  });
  // try {
  //   if (req.headers["x-goog-channel-token"] !== process.env.GOOGLE_WEBHOOK_TOKEN) {
  //     return res.status(403).json({ message: "Invalid Channel Token" });
  //   }
  //   if (typeof req.headers["x-goog-channel-id"] !== "string") {
  //     return res.status(403).json({ message: "Missing Channel ID" });
  //   }

  //   const selectedCalendar = await SelectedCalendarRepository.findByGoogleChannelId(
  //     req.headers["x-goog-channel-id"]
  //   );

  //   if (!selectedCalendar) {
  //     return res.status(200).json({
  //       message: `No selected calendar found for googleChannelId: ${req.headers["x-goog-channel-id"]}`,
  //     });
  //   }
  //   const { credential } = selectedCalendar;
  //   if (!credential) {
  //     return res.status(200).json({
  //       message: `No credential found for selected calendar for googleChannelId: ${req.headers["x-goog-channel-id"]}`,
  //     });
  //   }
  //   const { selectedCalendars } = credential;
  //   const calendar = await getCalendar(credential);
  //   if (
  //     selectedCalendar.user.teams
  //       .flatMap((team) => team.team.features)
  //       .some((f) => f.featureId === "calendar-cache")
  //   ) {
  //     await calendar?.fetchAvailabilityAndSetCache?.(selectedCalendars);
  //   }

  //   await handleCalendarSync(calendar as GoogleCalendarServiceType, credential);

  //   return res.status(200).json({ message: "ok" });
  // } catch (e) {
  //   log.error(safeStringify(e));
  //   return res.status(500).json({ message: "Internal Server Error" });
  // }
}

const checkIfBookingDataChanged = (
  existingBooking: ExistingBookingType,
  bookingUpdateData: Prisma.BookingCreateInput
) => {
  const isDateEqual = (date1: Date | string, date2: Date | string) =>
    new Date(date1).getTime() === new Date(date2).getTime();

  return (
    existingBooking.title !== bookingUpdateData.title ||
    existingBooking.description !== bookingUpdateData.description ||
    existingBooking.location !== bookingUpdateData.location ||
    existingBooking.iCalUID !== bookingUpdateData.iCalUID ||
    !isEqual(existingBooking.responses, bookingUpdateData.responses) ||
    !isEqual(existingBooking.metadata, bookingUpdateData.metadata) ||
    !isDateEqual(existingBooking.startTime, bookingUpdateData.startTime) ||
    !isDateEqual(existingBooking.endTime, bookingUpdateData.endTime) ||
    (bookingUpdateData.recurringEventId !== undefined &&
      existingBooking.recurringEventId !== bookingUpdateData.recurringEventId)
  );
};
const handleCalendarSync = async (calendar: GoogleCalendarServiceType, credential: CredentialType) => {
  try {
    if (!credential) {
      log.error("No credential found for selected calendar for googleChannelId");
      return;
    }
    log.info("Handling Gcal sync");
    const currentTime = `${new Date().toISOString().slice(0, 19)}Z`;
    const externalEvents: {
      selectedCalendar: (typeof credential.selectedCalendars)[number];
      events: {
        confirmedEvents: calendar_v3.Schema$Event[];
        cancelledEvents: calendar_v3.Schema$Event[];
      };
    }[] = [];
    for (const selectedCalendar of credential.selectedCalendars) {
      const params = {
        eventTypes: ["default"],
        maxResults: 250,
        timeMin: currentTime,
        showDeleted: true,
        calendarId: selectedCalendar.externalId,
      };

      externalEvents.push({ selectedCalendar, events: await calendar.getCalendarEvents(params) });
    }

    await handleExternalEvents(externalEvents);
    log.info("Successfully synced google calendar");
  } catch (e) {
    log.error("Failed to sync google calendar", safeStringify(e));
  }
};

function getCancelledEvtPromises({
  ext,
}: {
  ext: {
    selectedCalendar: {
      userId: number;
      externalId: string;
      credentialId: number | null;
    };
    events: {
      cancelledEvents: calendar_v3.Schema$Event[];
    };
  };
}): Promise<
  | Prisma.BookingGetPayload<{
      select: {
        id: true;
        uid: true;
        status: true;
        metadata: true;
      };
    }>
  | undefined
>[] {
  return ext.events.cancelledEvents.map(async (evt) => {
    if (!evt.id) return undefined;

    const existingBooking = await prisma.booking.findUnique({
      where: { uid: evt.id },
      select: {
        id: true,
        uid: true,
        status: true,
        metadata: true,
      },
    });

    if (!existingBooking) {
      log.warn("Booking to be cancelled not found");
      return undefined;
    }

    if (evt.recurrence) {
      const updateData = {
        metadata: {
          ...isPrismaObjOrUndefined(existingBooking.metadata),
          recurrencePattern: parseRecurrenceDetails(evt.recurrence),
        },
      };

      const hasMetadataChanged = !isEqual(existingBooking.metadata, updateData.metadata);

      if (hasMetadataChanged) {
        return prisma.booking.update({
          where: { uid: evt.id },
          data: updateData,
        });
      }

      return existingBooking;
    }

    //check if booking is already cancelled
    if (existingBooking.status === BookingStatus.CANCELLED) {
      return existingBooking;
    }

    // If not recurring, update we simply update status to CANCELLED
    const updatedBooking = await prisma.booking.update({
      where: { uid: evt.id },
      data: { status: BookingStatus.CANCELLED },
    });

    log.info(`Marked as cancelled: ${updatedBooking.id}`);
    return updatedBooking;
  });
}

async function getConfirmedEvtPromises({
  ext,
}: {
  ext: {
    selectedCalendar: {
      userId: number;
      externalId: string;
      credentialId: number | null;
    };
    events: {
      confirmedEvents: calendar_v3.Schema$Event[];
    };
  };
}) {
  try {
    // Fetch all existing bookings with their attendees in bulk
    const eventIds = ext.events.confirmedEvents.map((evt) => evt.id).filter(Boolean) as string[];

    const existingBookings = await prisma.booking.findMany({
      where: {
        uid: { in: eventIds },
      },
      select: {
        attendees: true,
        uid: true,
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        location: true,
        metadata: true,
        iCalUID: true,
        recurringEventId: true,
        responses: true,
      },
    });

    // Create a map for quick lookup
    const bookingsMap = new Map(existingBookings.map((booking) => [booking.uid, booking]));

    return ext.events.confirmedEvents.map(async (evt) => {
      try {
        if (!evt.id) {
          return;
        }

        const { booker, guests } = (evt.attendees ?? []).reduce(
          (acc, attendee) => {
            if (attendee.organizer === true) {
              acc.booker = attendee;
            } else {
              acc.guests.push(attendee);
            }
            return acc;
          },
          {
            booker: {} as calendar_v3.Schema$EventAttendee,
            guests: [] as calendar_v3.Schema$EventAttendee[],
          }
        );

        //check if event was booked by a cal.id user, if yes we will associate this event with the corresponding user.id
        const bookerFromDb = booker.email
          ? await prisma.user.findFirst({ where: { email: booker.email } })
          : null;

        const attendeesData = [...(bookerFromDb ? [] : [booker]), ...guests]
          .filter((at) => at.email)
          .map(
            (at) =>
              ({
                name: at.displayName ?? at.email?.split("@")[0] ?? "",
                email: at.email,
                timeZone: evt.start?.timeZone ?? getServerTimezone(),
              } as Prisma.AttendeeCreateWithoutBookingSeatInput)
          );

        const location = getLocation(evt.location ? evt.location : evt.hangoutLink);
        const bookingData: Prisma.BookingCreateInput = {
          uid: evt.id ?? short.generate(),
          responses: {
            ...(booker.displayName && { name: booker.displayName }),
            ...(booker.email && { email: booker.email }),
            guests: [...(attendeesData.map((at) => at?.email).filter(Boolean) || [])],
            location: {
              value: evt.location ? evt.location : evt.hangoutLink,
              optionValue: "",
            },
          } as Prisma.InputJsonValue,
          title: `Google Calendar Event : ${evt.summary ?? ""}`,
          destinationCalendar: {
            connect: {
              externalId: ext.selectedCalendar.externalId,
              userId: ext.selectedCalendar.userId,
              credentialId: ext.selectedCalendar.credentialId,
            },
          },
          startTime: dayjs(evt.start?.dateTime).utc().toDate(),
          endTime: dayjs(evt.end?.dateTime).utc().toDate(),
          description: evt.description ?? "",
          customInputs: {},
          status: BookingStatus.ACCEPTED,
          location: location,
          metadata: {
            videoCallUrl: evt.location ? evt.location : evt.hangoutLink,
            isExternalEvent: true,
            ...(evt.recurrence && {
              recurrencePattern: parseRecurrenceDetails(evt.recurrence),
            }),
          },
          ...(evt.recurrence && { recurringEventId: `recur_${evt.id}` }),
          iCalUID: evt.iCalUID ?? "",
          ...(bookerFromDb && {
            user: {
              connect: {
                id: bookerFromDb.id,
              },
            },
          }),
        };

        const existingBooking = bookingsMap.get(evt.id as string);

        return prisma.$transaction(
          async (tx) => {
            if (existingBooking) {
              const { uid: _, ...bookingUpdateData } = bookingData;

              // Check if booking data has changed
              const hasBookingDataChanged = checkIfBookingDataChanged(existingBooking, bookingData);
              let updatedBooking = existingBooking;

              // Only update booking if data has changed
              if (hasBookingDataChanged) {
                const result = await tx.booking.update({
                  where: { id: existingBooking.id },
                  data: { ...bookingUpdateData },
                  select: {
                    attendees: true,
                    uid: true,
                    id: true,
                    title: true,
                    description: true,
                    startTime: true,
                    endTime: true,
                    location: true,
                    metadata: true,
                    iCalUID: true,
                    recurringEventId: true,
                    responses: true,
                  },
                });
                updatedBooking = result;
              }

              // Check if attendees have changed
              const existingEmails = new Set(existingBooking.attendees.map((a) => a.email));
              const newEmails = new Set(attendeesData.map((a) => a.email));
              const attendeesChanged =
                existingEmails.size !== newEmails.size ||
                Array.from(newEmails).some((email) => !existingEmails.has(email));

              // Only update attendees if they've changed
              if (attendeesChanged) {
                await tx.attendee.deleteMany({
                  where: { bookingId: existingBooking.id },
                });

                await tx.attendee.createMany({
                  skipDuplicates: true,
                  data: attendeesData.map((at) => ({
                    ...at,
                    bookingId: existingBooking.id,
                  })),
                });
              }

              return updatedBooking;
            } else {
              try {
                // Create new booking with attendees
                const newBooking = await tx.booking.create({
                  data: { ...bookingData },
                });

                await tx.attendee.createMany({
                  skipDuplicates: true,
                  data: attendeesData.map((at) => ({
                    ...at,
                    bookingId: newBooking.id,
                  })),
                });

                return newBooking;
              } catch (error) {
                // Handle unique constraint violation (race condition)
                if (
                  error instanceof Prisma.PrismaClientKnownRequestError &&
                  error.code === "P2002" &&
                  (error.meta?.target as string[])?.includes("uid")
                ) {
                  log.info(
                    `Race condition detected for booking with uid: ${bookingData.uid}.Skipping this event.`
                  );
                  return;
                }
                // If it's not a unique constraint violation or we couldn't find the booking, rethrow
                throw error;
              }
            }
          },
          { timeout: 15000 }
        );
      } catch (error) {
        log.error("Error in getConfirmedEvtPromises", safeStringify(error));
        throw error;
      }
    });
  } catch (error) {
    log.error("Error in getConfirmedEvtPromises", safeStringify(error));
    throw error;
  }
}

function getLocation(location?: string | null) {
  if (!location) return null;
  if (location.includes("meet")) return MeetLocationType;
  if (location.includes("zoom")) return ZoomLocationType;
  return location;
}

function parseRecurrenceDetails(details: string[]): {
  recurrencePattern: {
    RRULE?: string;
    EXRULE?: string;
    RDATE?: string;
    EXDATE?: string;
  };
} {
  try {
    const recurrencePattern: {
      [key: string]: string | undefined;
      RRULE?: string;
      EXRULE?: string;
      RDATE?: string;
      EXDATE?: string;
    } = {};

    details.forEach((line) => {
      const [key, value] = line.split(":");
      if (!key) return;

      if (["RRULE", "EXRULE", "RDATE", "EXDATE"].includes(key)) {
        recurrencePattern[key] = value || "";
      }
    });

    return { recurrencePattern };
  } catch (error) {
    return { recurrencePattern: {} };
  }
}

async function handleExternalEvents(
  externalEvents: {
    selectedCalendar: {
      userId: number;
      externalId: string;
      credentialId: number | null;
    };
    events: {
      confirmedEvents: calendar_v3.Schema$Event[];
      cancelledEvents: calendar_v3.Schema$Event[];
    };
  }[]
) {
  try {
    const evtPromises = externalEvents.map(async (ext) => {
      try {
        const confirmedEvtPromises = await getConfirmedEvtPromises({
          ext: {
            selectedCalendar: ext.selectedCalendar,
            events: {
              confirmedEvents: ext.events.confirmedEvents,
            },
          },
        });
        const cancelledEvtPromises = getCancelledEvtPromises({
          ext: {
            selectedCalendar: ext.selectedCalendar,
            events: {
              cancelledEvents: ext.events.cancelledEvents,
            },
          },
        });

        return [...confirmedEvtPromises, ...cancelledEvtPromises];
      } catch (error) {
        throw error;
      }
    });

    try {
      const results = await Promise.allSettled(evtPromises);
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      log.info(`Successfully synced ${successful} google calendar events, ${failed} failed`);

      // Log any rejected promises
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          log.error(`Failed to sync event at index ${index}:`, safeStringify(result.reason));
        }
      });
    } catch (error) {
      throw error;
    }
  } catch (e) {
    log.error("Failed to sync google calendar", safeStringify(e));
  }
}

export default defaultHandler({
  POST: Promise.resolve({ default: postHandler }),
});
