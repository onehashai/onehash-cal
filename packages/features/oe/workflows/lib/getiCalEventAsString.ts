import { createEvent } from "ics";
import type { DateArray } from "ics";
import { RRule } from "rrule";
import { v4 as uuidv4 } from "uuid";

import dayjs from "@calcom/dayjs";
import { parseRecurringEvent } from "@calcom/lib";
import type { Prisma, User } from "@calcom/prisma/client";

type Booking = Prisma.BookingGetPayload<{
  include: {
    eventType: true;
    attendees: true;
  };
}>;

function generateRecurrencePattern(
  eventTypeData: { recurringEvent?: Prisma.JsonValue } | null
): string | undefined {
  if (!eventTypeData?.recurringEvent) return undefined;

  const parsedRecurrence = parseRecurringEvent(eventTypeData.recurringEvent);
  if (!parsedRecurrence?.count) return undefined;

  const rruleInstance = new RRule(parsedRecurrence);
  return rruleInstance.toString().replace("RRULE:", "");
}

function convertToDateArray(dateTimeString: string): DateArray {
  const dateComponents = dayjs(dateTimeString).utc().toArray().slice(0, 6);

  return dateComponents.map((component, index) => (index === 1 ? component + 1 : component)) as DateArray;
}

function calculateEventDuration(startDateTime: Date, endDateTime: Date): { minutes: number } {
  const startMoment = dayjs(startDateTime.toISOString() || "");
  const endMoment = dayjs(endDateTime.toISOString() || "");
  const durationInMinutes = endMoment.diff(startMoment, "minute");

  return { minutes: durationInMinutes };
}

function buildAttendeeConfiguration(attendeesList: Array<{ name: string; email: string }>) {
  if (!attendeesList.length) return [];

  const primaryAttendee = attendeesList[0];
  return [
    {
      name: primaryAttendee.name,
      email: primaryAttendee.email,
      partstat: "ACCEPTED" as const,
      role: "REQ-PARTICIPANT" as const,
      rsvp: true,
    },
  ];
}

export function getiCalEventAsString(
  booking: Pick<Booking, "startTime" | "endTime" | "description" | "location" | "attendees"> & {
    eventType: { recurringEvent?: Prisma.JsonValue; title?: string } | null;
    user: Partial<User> | null;
  }
) {
  const eventIdentifier = uuidv4();
  const repetitionRule = generateRecurrencePattern(booking.eventType);
  const startDateArray = convertToDateArray(booking.startTime.toISOString() || "");
  const eventDuration = calculateEventDuration(booking.startTime, booking.endTime);
  const participantList = buildAttendeeConfiguration(booking.attendees);

  const calendarEventConfig = {
    uid: eventIdentifier,
    startInputType: "utc" as const,
    start: startDateArray,
    duration: eventDuration,
    title: booking.eventType?.title || "",
    description: booking.description || "",
    location: booking.location || "",
    organizer: {
      email: booking.user?.email || "",
      name: booking.user?.name || "",
    },
    attendees: participantList,
    method: "REQUEST" as const,
    status: "CONFIRMED" as const,
    ...(repetitionRule && { recurrenceRule: repetitionRule }),
  };

  const generatedEvent = createEvent(calendarEventConfig);

  if (generatedEvent.error) {
    throw generatedEvent.error;
  }

  return generatedEvent.value;
}
