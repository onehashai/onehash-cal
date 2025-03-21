import type { calendar_v3 } from "@googleapis/calendar";
import type GoogleCalendarService from "googlecalendar/lib/CalendarService";
import type { NextApiRequest } from "next";
import short from "short-uuid";

import dayjs from "@calcom/dayjs";
import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import { SelectedCalendarRepository } from "@calcom/lib/server/repository/selectedCalendar";
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

async function postHandler(req: NextApiRequest) {
  if (req.headers["x-goog-channel-token"] !== process.env.GOOGLE_WEBHOOK_TOKEN) {
    throw new HttpError({ statusCode: 403, message: "Invalid API key" });
  }
  if (typeof req.headers["x-goog-channel-id"] !== "string") {
    throw new HttpError({ statusCode: 403, message: "Missing Channel ID" });
  }

  const selectedCalendar = await SelectedCalendarRepository.findByGoogleChannelId(
    req.headers["x-goog-channel-id"]
  );

  if (!selectedCalendar) {
    throw new HttpError({
      statusCode: 200,
      message: `No selected calendar found for googleChannelId: ${req.headers["x-goog-channel-id"]}`,
    });
  }
  const { credential } = selectedCalendar;
  if (!credential)
    throw new HttpError({
      statusCode: 200,
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

  return { message: "ok" };
}

const handleCalendarSync = async (calendar: GoogleCalendarService, credential: CredentialType) => {
  try {
    log.info("Handling Gcal sync");
    const currentTime = `${new Date().toISOString().slice(0, 19)}Z`;

    const params = {
      eventTypes: ["default"],
      maxResults: 250,
      timeMin: currentTime,
      showDeleted: true,
    };
    const externalEvents = await calendar.getCalendarEvents(params);
    const { confirmedEvents, cancelledEvents } = externalEvents.reduce(
      (acc, evt) => {
        if (evt.status === "confirmed") acc.confirmedEvents.push(evt);
        else if (evt.status === "cancelled") acc.cancelledEvents.push(evt);
        return acc;
      },
      { confirmedEvents: [] as calendar_v3.Schema$Event[], cancelledEvents: [] as calendar_v3.Schema$Event[] }
    );
    await handleConfirmedEvents(confirmedEvents, credential);
    await handleCancelledEvents(cancelledEvents, credential);
    log.info("Successfully synced google calendar");
  } catch (e) {
    log.error("Failed to sync google calendar", safeStringify(e));
  }
};

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

async function handleConfirmedEvents(
  confirmedEvents: calendar_v3.Schema$Event[],
  credential: CredentialType
) {
  const createBookingPromises = confirmedEvents.map((evt) => {
    if (!evt.id) {
      return Promise.resolve();
    }
    const { booker, guests, currentUser } = (evt.attendees ?? []).reduce(
      (acc, attendee) => {
        if (attendee.email === credential?.user?.email) {
          acc.currentUser = attendee;
        } else if (attendee.organizer === true) {
          acc.booker = attendee;
        } else {
          acc.guests.push(attendee);
        }
        return acc;
      },
      {
        booker: {} as calendar_v3.Schema$EventAttendee,
        currentUser: {} as calendar_v3.Schema$EventAttendee,
        guests: [] as calendar_v3.Schema$EventAttendee[],
      }
    );

    const attendeesData: Prisma.AttendeeCreateWithoutBookingSeatInput[] = [booker, ...guests].map(
      (at) =>
        ({
          name: at.displayName,
          email: at.email,
          timeZone: evt.start?.timeZone,
        } as Prisma.AttendeeCreateWithoutBookingSeatInput)
    );

    const bookingData: Prisma.BookingCreateInput = {
      uid: evt.id ?? short.generate(),
      ...(credential?.user?.email && { userPrimaryEmail: credential.user.email }),
      responses: {
        name: booker.displayName,
        email: booker.email,
        guests: [...(guests.map((at) => at?.email).filter(Boolean) || [])],
        location: {
          value: evt.location === "Google" ? MeetLocationType : evt.location,
          optionValue: "",
        },
      } as Prisma.InputJsonValue,
      title: `Google Calendar Event : ${evt.summary ?? ""}`,

      startTime: dayjs(evt.start?.dateTime).utc().toDate(),
      endTime: dayjs(evt.end?.dateTime).utc().toDate(),
      description: evt.description ?? "",
      customInputs: {},
      status: BookingStatus.ACCEPTED,
      location: evt.location === "Google" ? MeetLocationType : evt.location,
      // eventType: {
      //   create: {},
      // },
      metadata: {
        videoCallUrl: evt.hangoutLink,
        isExternalEvent: true,
        ...(evt.recurrence && {
          recurrencePattern: parseRecurrenceDetails(evt.recurrence),
        }),
      },
      ...(evt.recurrence && { recurringEventId: `recur_${evt.id}` }),
      attendees: {
        createMany: {
          data: attendeesData,
        },
      },
      iCalUID: evt.iCalUID ?? "",

      ...(credential?.userId && {
        ...(evt.summary && {
          destinationCalendar: {
            connect: { externalId: evt.summary, userId: credential.userId },
          },
        }),
        user: {
          connect: {
            id: credential.userId,
          },
        },
      }),
    };

    return prisma.booking.upsert({
      where: {
        uid: evt.id,
      },
      update: {
        ...bookingData,
      },
      create: {
        ...bookingData,
      },
    });
  });

  await Promise.all(createBookingPromises);
}
async function handleCancelledEvents(
  cancelledEvents: calendar_v3.Schema$Event[],
  credential: CredentialType
) {
  const bookingCancellationPromises = cancelledEvents.map((evt) => {
    if (!evt.id) {
      return Promise.resolve();
    }
    const { booker, guests, currentUser } = (evt.attendees ?? []).reduce(
      (acc, attendee) => {
        if (attendee.email === credential?.user?.email) {
          acc.currentUser = attendee;
        } else if (attendee.organizer === true) {
          acc.booker = attendee;
        } else {
          acc.guests.push(attendee);
        }
        return acc;
      },
      {
        booker: {} as calendar_v3.Schema$EventAttendee,
        currentUser: {} as calendar_v3.Schema$EventAttendee,
        guests: [] as calendar_v3.Schema$EventAttendee[],
      }
    );

    const attendeesData: Prisma.AttendeeCreateWithoutBookingSeatInput[] = [booker, ...guests].map(
      (at) =>
        ({
          name: at.displayName,
          email: at.email,
          timeZone: evt.start?.timeZone,
        } as Prisma.AttendeeCreateWithoutBookingSeatInput)
    );

    const cancelledBookingData: Prisma.BookingCreateInput = {
      uid: evt.id,
      ...(credential?.user?.email && { userPrimaryEmail: credential.user.email }),
      responses: {
        name: booker.displayName,
        email: booker.email,
        guests: [...(guests.map((at) => at?.email).filter(Boolean) || [])],
        location: {
          value: evt.location === "Google" ? MeetLocationType : evt.location,
          optionValue: "",
        },
      } as Prisma.InputJsonValue,
      title: `Google Calendar Event : ${evt.summary ?? ""}`,

      startTime: dayjs(evt.start?.dateTime).utc().toDate(),
      endTime: dayjs(evt.end?.dateTime).utc().toDate(),
      description: evt.description ?? "",
      customInputs: {},
      status: BookingStatus.CANCELLED,
      location: evt.location === "Google" ? MeetLocationType : evt.location,
      // eventType: {
      //   create: {},
      // },
      metadata: {
        videoCallUrl: evt.hangoutLink,
        isExternalEvent: true,
        ...(evt.recurrence && {
          recurrencePattern: parseRecurrenceDetails(evt.recurrence),
        }),
      },
      ...(evt.recurrence && { recurringEventId: `recur_${evt.id}` }),
      attendees: {
        createMany: {
          data: attendeesData,
        },
      },
      iCalUID: evt.iCalUID ?? "",

      ...(credential?.userId && {
        ...(evt.summary && {
          destinationCalendar: {
            connect: { externalId: evt.summary, userId: credential.userId },
          },
        }),
        user: {
          connect: {
            id: credential.userId,
          },
        },
      }),
    };

    return prisma.booking.upsert({
      where: {
        uid: evt.id,
      },
      update: {
        status: BookingStatus.CANCELLED,
      },
      create: {
        ...cancelledBookingData,
      },
    });
  });

  await Promise.all(bookingCancellationPromises);
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
