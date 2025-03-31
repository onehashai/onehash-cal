import type { calendar_v3 } from "@googleapis/calendar";
import type GoogleCalendarService from "googlecalendar/lib/CalendarService";
import type { NextApiRequest, NextApiResponse } from "next";
import short from "short-uuid";

import dayjs from "@calcom/dayjs";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { defaultHandler } from "@calcom/lib/server";
import { SelectedCalendarRepository } from "@calcom/lib/server/repository/selectedCalendar";
import { getServerTimezone } from "@calcom/lib/timezone";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { BookingStatus } from "@calcom/prisma/enums";

import { getCalendar } from "../../_utils/getCalendar";
import { MeetLocationType } from "../../locations";

const log = logger.getSubLogger({ prefix: ["api/integrations/googlecalendar/webhook"] });
type FindByGoogleChannelIdReturnType = Awaited<
  ReturnType<typeof SelectedCalendarRepository.findByGoogleChannelId>
>;
type CredentialType = NonNullable<FindByGoogleChannelIdReturnType>["credential"];

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.headers["x-goog-channel-token"] !== process.env.GOOGLE_WEBHOOK_TOKEN) {
      return res.status(403).json({ message: "Invalid Channel Token" });
    }
    if (typeof req.headers["x-goog-channel-id"] !== "string") {
      return res.status(403).json({ message: "Missing Channel ID" });
    }

    const selectedCalendar = await SelectedCalendarRepository.findByGoogleChannelId(
      req.headers["x-goog-channel-id"]
    );

    if (!selectedCalendar) {
      return res.status(200).json({
        message: `No selected calendar found for googleChannelId: ${req.headers["x-goog-channel-id"]}`,
      });
    }
    const { credential } = selectedCalendar;
    if (!credential)
      return res.status(200).json({
        message: `No credential found for selected calendar for googleChannelId: ${req.headers["x-goog-channel-id"]}`,
      });
    const { selectedCalendars } = credential;
    const calendar = await getCalendar(credential);
    if (
      selectedCalendar.user.teams
        .flatMap((team) => team.team.features)
        .some((f) => f.featureId === "calendar-cache")
    ) {
      await calendar?.fetchAvailabilityAndSetCache?.(selectedCalendars);
    }

    await handleCalendarSync(calendar as GoogleCalendarService, credential);

    return res.status(200).json({ message: "ok" });
  } catch (e) {
    log.error(safeStringify(e));
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

const handleCalendarSync = async (calendar: GoogleCalendarService, credential: CredentialType) => {
  try {
    if (!credential) return log.error("No credential found for selected calendar for googleChannelId");
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
}): // credential: {
//   user: { email: string } | null;
//   id: number;
//   userId: number | null;
//   selectedCalendars: {
//     userId: number;
//     googleChannelId: string | null;
//     externalId: string;
//     integration: string;
//     credentialId: number | null;
//     googleChannelKind: string | null;
//     googleChannelResourceId: string | null;
//     googleChannelResourceUri: string | null;
//     googleChannelExpiration: string | null;
//     domainWideDelegationCredentialId: string | null;
//     googleSyncEnabled: boolean;
//   }[];
//   type: string;
//   key: Prisma.JsonValue;
//   teamId: number | null;
//   appId: string | null;
//   invalid: boolean | null;
// } | null
Promise<any>[] {
  return ext.events.cancelledEvents.map(async (evt) => {
    if (!evt.id) return;

    if (evt.recurrence) {
      const existingBooking = await prisma.booking.findUnique({
        where: { uid: evt.id },
      });

      if (!existingBooking) {
        log.warn("Recurrence Booking not found to update recurrence pattern");
        return;
      }

      const existingMetadataParsed = isPrismaObjOrUndefined(existingBooking.metadata);

      return prisma.booking.update({
        where: { uid: evt.id },
        data: {
          metadata: {
            ...(existingMetadataParsed && { existingMetadataParsed }),
            recurrencePattern: parseRecurrenceDetails(evt.recurrence),
          },
        },
      });
    }

    // If not recurring, update we simply update status to CANCELLED
    return prisma.booking
      .update({
        where: { uid: evt.id },
        data: { status: BookingStatus.CANCELLED },
      })
      .then((res) => console.log(`Marked as cancelled: ${res.id}`));
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
  return ext.events.confirmedEvents.map(async (evt) => {
    if (!evt.id) {
      return Promise.resolve();
    }
    const { booker, guests } = (evt.attendees ?? []).reduce(
      (acc, attendee) => {
        // if (attendee.email === credential?.user?.email) {
        //   acc.currentUser = attendee;
        // } else
        if (attendee.organizer === true) {
          acc.booker = attendee;
        } else {
          acc.guests.push(attendee);
        }
        return acc;
      },
      {
        booker: {} as calendar_v3.Schema$EventAttendee,
        // currentUser: {} as calendar_v3.Schema$EventAttendee,
        guests: [] as calendar_v3.Schema$EventAttendee[],
      }
    );

    //check if event was booked by a cal.id user, if yes we will associate this event with the corresponding user.id
    const bookerFromDb = booker.email
      ? await prisma.user.findFirst({ where: { email: booker.email } })
      : null;

    // const finalAttendees = await fetchOrCreateAttendees(bookerFromDb, booker, guests, evt);
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
    const bookingData: Prisma.BookingCreateInput = {
      uid: evt.id ?? short.generate(),
      // ...(credential?.user?.email && { userPrimaryEmail: credential.user.email }),
      responses: {
        name: booker.displayName,
        email: booker.email,
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
      location: evt.location ? evt.location : MeetLocationType,
      // eventType: {
      //   create: {},
      // },
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

    return prisma.$transaction(async (tx) => {
      const existingBooking = await tx.booking.findUnique({
        where: { uid: evt.id as string },
      });

      if (existingBooking) {
        await tx.attendee.deleteMany({
          where: { bookingId: existingBooking.id },
        });

        return await tx.booking.update({
          where: { id: existingBooking.id },
          data: {
            ...bookingData,
            attendees: {
              createMany: {
                data: attendeesData,
                skipDuplicates: true,
              },
            },
          },
        });
      } else {
        try {
          const createdBooking = await tx.booking.create({
            data: {
              ...bookingData,
            },
          });

          await tx.attendee.createMany({
            skipDuplicates: true,
            data: attendeesData.map((at) => ({
              ...at,
              bookingId: createdBooking.id,
            })),
          });
        } catch (e) {
          log.error(`Booking already created with UID : ${evt.id}`);
        }
      }
    });
  });
}

function parseRecurrenceDetails(details: string[]): {
  recurrencePattern: {
    RRULE?: string;
    EXRULE?: string;
    RDATE?: string;
    EXDATE?: string;
  };
} {
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
  const evtPromises = externalEvents.map(async (ext) => {
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
  });
  try {
    const res = await Promise.allSettled(evtPromises);
    log.info("Successfully synced google calendar", safeStringify(res));
  } catch (e) {
    console.error("Failed to sync google calendar", safeStringify(e));
    log.error("Failed to sync google calendar", safeStringify(e));
  }
}

export default defaultHandler({
  // POST: Promise.resolve({ default: defaultResponder(postHandler) }),
  POST: Promise.resolve({ default: postHandler }),
});
