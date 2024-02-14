import type {
  CalendlyEventType,
  CalendlyScheduledEventLocation,
  CalendlyScheduledEvent,
  CalendlyScheduledEventInvitee,
  CalendlyUserAvailabilityRules,
  CalendlyUserAvailabilitySchedules,
} from "@onehash/calendly";
import { CalendlyAPIService, CalendlyOAuthProvider } from "@onehash/calendly";
import { inngestClient } from "@pages/api/inngest";
import type { NextApiRequest, NextApiResponse } from "next";

import { MeetLocationType } from "@calcom/app-store/locations";
import dayjs from "@calcom/dayjs";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import { handleConfirmation } from "@calcom/features/bookings/lib/handleConfirmation";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { defaultHandler, defaultResponder, getTranslation } from "@calcom/lib/server";
import { getUsersCredentials } from "@calcom/lib/server/getUsersCredentials";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { BookingStatus, IntegrationProvider, SchedulingType } from "@calcom/prisma/client";
import type { CalendarEvent } from "@calcom/types/Calendar";

type CalendlyScheduledEventWithScheduler = CalendlyScheduledEvent & {
  scheduled_by?: CalendlyScheduledEventInvitee;
};

type EventTypeWithScheduledEvent = {
  event_type: CalendlyEventType;
  scheduled_events: CalendlyScheduledEventWithScheduler[];
};

type CombinedAvailabilityRules = {
  type: "wday" | "date";
  interval: {
    from: string;
    to: string;
  };
  wdays?: number[];
  date?: Date;
};

//Maps the weekday to its corresponding number
const wdayMapping: { [key: string]: number } = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const {
  NEXT_PUBLIC_CALENDLY_CLIENT_ID,
  CALENDLY_CLIENT_SECRET,
  NEXT_PUBLIC_CALENDLY_REDIRECT_URI,
  NEXT_PUBLIC_CALENDLY_OAUTH_URL,
} = process.env;

//Updates the fresh tokens in db
const updateTokensInDb = async (params: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  createdAt: number;
  expiresIn: number;
}) => {
  const updatedDoc = await prisma.integrationAccounts.update({
    where: {
      userId_provider: {
        userId: parseInt(params.userId),
        provider: IntegrationProvider.CALENDLY,
      },
    },
    data: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresIn: params.expiresIn,
      createdAt: params.createdAt,
    },
  });
  return updatedDoc;
};

//Refreshes the token if expired
const refreshTokenIfExpired = async (
  userCalendlyIntegrationProvider: {
    userId: number;
    provider: "CALENDLY";
    tokenType: string | null;
    expiresIn: number | null;
    createdAt: number | null;
    refreshToken: string;
    accessToken: string;
    scope: string | null;
    ownerUniqIdentifier: string | null;
  },
  userId: string
) => {
  const cOService = new CalendlyOAuthProvider({
    clientId: NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    clientSecret: CALENDLY_CLIENT_SECRET ?? "",
    redirectUri: NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
    oauthUrl: NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });

  // Checking if the user token is valid
  const isTokenValid = await cOService.introspectToken({
    accessToken: userCalendlyIntegrationProvider.accessToken,
    refreshToken: userCalendlyIntegrationProvider.refreshToken,
  });
  //If user access token is expired then request for new access token
  if (!isTokenValid) {
    const freshTokenData = await cOService.requestNewAccessToken(
      userCalendlyIntegrationProvider.refreshToken
    );
    //update the new tokens in db and the current token state "userCalendlyIntegrationProvider"
    userCalendlyIntegrationProvider = await updateTokensInDb({
      userId: userId,
      accessToken: freshTokenData.access_token,
      refreshToken: freshTokenData.refresh_token,
      createdAt: freshTokenData.created_at,
      expiresIn: freshTokenData.expires_in,
    });
  }
  return userCalendlyIntegrationProvider;
};

//Fetches user data from Calendly including event types, availability schedules and scheduled events
const fetchCalendlyData = async (
  ownerUniqIdentifier: string,
  cAService: CalendlyAPIService
): Promise<(CalendlyEventType[] | CalendlyUserAvailabilitySchedules[] | CalendlyScheduledEvent[])[]> => {
  const promises = [];

  promises.push(cAService.getUserEventTypes(ownerUniqIdentifier));
  promises.push(cAService.getUserAvailabilitySchedules(ownerUniqIdentifier));
  promises.push(
    cAService.getUserScheduledEvents({
      userUri: ownerUniqIdentifier,
      minStartTime: new Date().toISOString(),
      status: "active",
    })
  );

  return await Promise.all(promises);
};

//Combines rules returned by Calendly ,based on the interval and type
const combinedRules = (rules: CalendlyUserAvailabilityRules[]): CombinedAvailabilityRules[] => {
  const combinedIntervals: { [key: string]: CombinedAvailabilityRules } = {};

  rules.forEach((rule) => {
    const ruleWInterval = rule.intervals?.find((interval) => interval.from && interval.to);
    if (!ruleWInterval) return;
    const key = `${ruleWInterval.from}-${ruleWInterval.to}`;
    if (rule.type === "wday" && rule.wday) {
      if (!combinedIntervals[key]) {
        combinedIntervals[key] = {
          type: "wday",
          interval: {
            from: ruleWInterval.from,
            to: ruleWInterval.to,
          },
          wdays: [wdayMapping[rule.wday]],
        };
      } else {
        combinedIntervals[key].wdays?.push(wdayMapping[rule.wday]);
      }
    } else if (rule.type === "date" && rule.date) {
      if (!combinedIntervals[key]) {
        combinedIntervals[key] = {
          type: "date",
          interval: {
            from: ruleWInterval.from,
            to: ruleWInterval.to,
          },
          date: new Date(rule.date),
        };
      }
    }
  });
  return Object.values(combinedIntervals);
};

//Maps the scheduled events with its corresponding scheduler
const getEventScheduler = async (
  userScheduledEvents: CalendlyScheduledEvent[],
  getUserScheduledEventInvitees: (
    uuid: string,
    count?: number,
    pageToken?: string | undefined
  ) => Promise<CalendlyScheduledEventInvitee[]>
): Promise<CalendlyScheduledEventWithScheduler[]> => {
  const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = [];

  // Create an array of promises for fetching invitees
  const inviteePromises = userScheduledEvents.map((userScheduledEvent) => {
    const uuid = userScheduledEvent.uri.substring(userScheduledEvent.uri.lastIndexOf("/") + 1);
    return getUserScheduledEventInvitees(uuid);
  });

  // Fetching all invitees concurrently
  const allInvitees = await Promise.all(inviteePromises);

  // Iterate through events and check payment(if the booking is paid , we skip it )
  userScheduledEvents.forEach((userScheduledEvent, index) => {
    const scheduledEventInvitees = allInvitees[index];
    const scheduled_by = scheduledEventInvitees[0] || null;

    // Skip paid bookings, as it'll cause integrity issues
    if (scheduled_by?.payment !== undefined && scheduled_by?.payment !== null) {
      return;
    }

    userScheduledEventsWithScheduler.push({
      ...userScheduledEvent,
      scheduled_by,
    });
  });

  return userScheduledEventsWithScheduler;
};

//Merges the scheduled events with its corresponding event types while checking for overlapping bookings
const mergeEventTypeAndScheduledEvent = async (
  eventTypeList: CalendlyEventType[],
  scheduledEventList: CalendlyScheduledEventWithScheduler[]
): Promise<EventTypeWithScheduledEvent[]> => {
  const scheduledEventsMap: Record<string, CalendlyScheduledEventWithScheduler[]> = {};

  const overlappingEvent = await Promise.all(
    scheduledEventList.map((scheduledEvent) => doesBookingOverlap(scheduledEvent))
  );

  scheduledEventList.map((scheduledEvent, index) => {
    const eventTypeURI = scheduledEvent.event_type;

    if (!scheduledEventsMap[eventTypeURI]) {
      scheduledEventsMap[eventTypeURI] = [];
    }

    const isOverlapping = overlappingEvent[index];
    if (!isOverlapping) {
      scheduledEventsMap[eventTypeURI].push(scheduledEvent);
    }
  });

  return eventTypeList.map((eventType) => ({
    event_type: eventType,
    scheduled_events: scheduledEventsMap[eventType.uri] || [],
  }));
};

//Checks if the booking overlaps with the existing bookings
const doesBookingOverlap = async (userScheduledEvent: CalendlyScheduledEvent) => {
  return await prisma.booking.findFirst({
    where: {
      AND: [
        {
          OR: [
            {
              AND: [
                { startTime: { gte: userScheduledEvent.start_time } },
                { startTime: { lt: userScheduledEvent.end_time } },
              ],
            },
            {
              AND: [
                { startTime: { lt: userScheduledEvent.start_time } },
                { endTime: { gt: userScheduledEvent.start_time } },
              ],
            },
            {
              AND: [
                { startTime: { lt: userScheduledEvent.end_time } },
                { endTime: { gt: userScheduledEvent.start_time } },
              ],
            },
          ],
        },
        {
          AND: [{ status: { not: BookingStatus.CANCELLED } }, { status: { not: BookingStatus.REJECTED } }],
        },
      ],
    },
  });
};

//Returns the datetime object from the time and timezone
const getDatetimeObjectFromTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number); // Convert to numbers

  // Get the current date in UTC
  const currentDate = dayjs().utc();

  // Create a new date object with the specified time
  const dateWithTime = currentDate.set("hour", hours).set("minute", minutes);

  // Convert to the specified timezone and format the output
  const formattedDate = dateWithTime.format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");

  return formattedDate;
};

//Returns the server timezone
const getServerTimezone = (): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone;
};

//Returns the attendees with timezone
const getAttendeesWithTimezone = (
  scheduledEvent: CalendlyScheduledEventWithScheduler
): Prisma.AttendeeCreateWithoutBookingSeatInput[] => {
  const attendeeInput: Prisma.AttendeeCreateWithoutBookingSeatInput[] = [];
  const timezone = scheduledEvent.scheduled_by?.timezone ?? getServerTimezone(); //using the scheduled_by timezone if available else using the server timezone

  const scheduledByAttendee: Prisma.AttendeeCreateWithoutBookingSeatInput = {
    name: scheduledEvent.scheduled_by?.name ?? "N/A",
    email: scheduledEvent.scheduled_by?.email ?? "N/A",
    timeZone: timezone,
  };
  attendeeInput.push(scheduledByAttendee);
  if (scheduledEvent.event_guests && scheduledEvent.event_guests.length > 0) {
    const eventGuest: Prisma.AttendeeCreateWithoutBookingSeatInput[] = scheduledEvent.event_guests.map(
      (event_guest) => ({
        name: "",
        email: event_guest.email,
        timeZone: timezone,
      })
    );
    attendeeInput.push(...eventGuest);
  }

  return attendeeInput;
};

//Imports the user availability schedule from Calendly
const importUserAvailability = async (
  userAvailabilitySchedules: CalendlyUserAvailabilitySchedules[],
  userIntID: number
) => {
  const userAvailabilityTimesToBeInserted: Prisma.ScheduleCreateInput[] = (
    userAvailabilitySchedules as CalendlyUserAvailabilitySchedules[]
  ).map((availabilitySchedule) => {
    const d: Prisma.ScheduleCreateInput = {
      user: { connect: { id: userIntID } },
      name: availabilitySchedule.name ?? "N/A",
      timeZone: availabilitySchedule.timezone,
      availability: {
        create: combinedRules(availabilitySchedule.rules).map((rule) => {
          return {
            startTime: getDatetimeObjectFromTime(rule.interval.from),
            endTime: getDatetimeObjectFromTime(rule.interval.to),
            days: rule.type === "wday" ? rule.wdays : undefined,
            date: rule.type === "date" ? rule.date : undefined,
            userId: userIntID,
          };
        }),
      },
    };

    return d;
  });

  const filteredAvailabilityTimes = await getUniqueAvailabilityTimes(
    userIntID,
    userAvailabilityTimesToBeInserted
  );

  await Promise.all(
    filteredAvailabilityTimes.map((availabilityTime) =>
      prisma.schedule.create({
        data: availabilityTime,
      })
    )
  );
};

const handleBookingLocation = (location: CalendlyScheduledEventLocation) => {
  switch (location.type) {
    case "physical":
      return `In Person Meeting\nAt ${location.location}`;
    case "outbound_call":
      return `Phone Call\nGuest's contact number ${location.location}`;
    case "inbound_call":
      return `Phone Call\nHost's contact number ${location.location}`;
    case "custom":
    case "ask_invitee":
      return String(location.location);
    case "google_conference":
    case "zoom":
    case "gotomeeting":
    case "microsoft_teams_conference":
    case "webex_conference":
      return MeetLocationType;
    default: //location type not specified
      return undefined;
  }
};

//Maps the  event types with its corresponding scheduled events to input schema
const mapEventTypeAndBookingsToInputSchema = (
  mergedList: EventTypeWithScheduledEvent[],
  userIntID: number
): {
  event_type_input: Prisma.EventTypeCreateInput;
  scheduled_events_input: Prisma.BookingCreateInput[];
}[] => {
  return mergedList.map((mergedItem) => {
    const { event_type, scheduled_events } = mergedItem;

    //Event Type Input
    const event_type_input: Prisma.EventTypeCreateInput = {
      title: event_type.name,
      slug: event_type.slug,
      description: event_type.description_plain,
      length: event_type.duration,
      hidden: event_type.secret,
      schedulingType:
        event_type.pooling_type === "collective"
          ? SchedulingType.COLLECTIVE
          : event_type.pooling_type === "round_robin"
          ? SchedulingType.ROUND_ROBIN
          : undefined,
      owner: { connect: { id: userIntID } },
      users: { connect: { id: userIntID } },
    };
    //Scheduled Booking Input
    let scheduled_events_input: Prisma.BookingCreateInput[] = [];
    if (scheduled_events.length > 0) {
      scheduled_events_input = scheduled_events.map((scheduledEvent) => {
        const scheduled_event_id = scheduledEvent.uri.substring(scheduledEvent.uri.lastIndexOf("/") + 1);
        return {
          uid: scheduled_event_id,
          user: { connect: { id: userIntID } },
          title: `${scheduledEvent.name} between ${scheduledEvent.scheduled_by?.name} and ${scheduledEvent.event_memberships[0].user_name}`,
          responses: {
            name: scheduledEvent.scheduled_by?.name ?? "N/A",
            email: scheduledEvent.scheduled_by?.email ?? "N/A",
            guests: scheduledEvent.event_guests?.map((g) => g.email),
          },
          startTime: new Date(scheduledEvent.start_time),
          endTime: new Date(scheduledEvent.end_time),
          attendees: {
            createMany: {
              data: getAttendeesWithTimezone(scheduledEvent),
            },
          },
          customInputs: {},
          location: handleBookingLocation(scheduledEvent.location),
          createdAt: new Date(scheduledEvent.created_at),
          updatedAt: new Date(scheduledEvent.updated_at),
          status: scheduledEvent.status === "canceled" ? BookingStatus.CANCELLED : BookingStatus.ACCEPTED,
          ...(scheduledEvent.status === "canceled" && {
            cancellationReason: scheduledEvent.cancellation?.reason,
          }),
        };
      });
    }
    return {
      event_type_input,
      scheduled_events_input,
    };
  });
};

//Inserts the event types and its corresponding bookings to db
const insertEventTypeAndBookingsToDB = async (
  eventTypesAndBookingsToBeInserted: {
    event_type_input: Prisma.EventTypeCreateInput;
    scheduled_events_input: Prisma.BookingCreateInput[];
  }[],
  userIntID: number
) => {
  const eventTypesAndBookingsInsertionPromises = eventTypesAndBookingsToBeInserted.map(
    async (eventTypeAndBooking) => {
      const { event_type_input, scheduled_events_input } = eventTypeAndBooking;

      // Perform the eventType upsert
      return prisma.eventType
        .upsert({
          create: event_type_input,
          update: {},
          where: {
            userId_slug: {
              userId: userIntID,
              slug: event_type_input.slug,
            },
          },
        })
        .then(async (upsertedEventType) => {
          // Once eventTypeResult is resolved, create the bookings
          const bookingPromises = scheduled_events_input.map((scheduledEvent) => {
            return prisma.booking.create({
              data: {
                ...scheduledEvent,
                eventType: { connect: { id: upsertedEventType.id } },
              },
            });
          });

          const createdBookings = await Promise.all(bookingPromises);
          return { upsertedEventType, createdBookings };
        });
    }
  );

  const eventTypesAndBookingsInsertedResults = await Promise.all(eventTypesAndBookingsInsertionPromises);
  return eventTypesAndBookingsInsertedResults;
};

//Returns the unique availability times not present in db
const getUniqueAvailabilityTimes = async (
  userIntID: number,
  userAvailabilityTimesToBeInserted: Prisma.ScheduleCreateInput[]
): Promise<Prisma.ScheduleCreateInput[]> => {
  const existingSchedules = await prisma.schedule.findMany({
    where: {
      user: { id: userIntID },
      name: { in: userAvailabilityTimesToBeInserted.map((availabilityTime) => availabilityTime.name) },
    },
    select: {
      name: true,
      userId: true,
    },
  });

  const existingSchedulesSet = new Set(
    existingSchedules.map((existing) => `${existing.name}-${existing.userId}`)
  );
  const filteredAvailabilityTimes = userAvailabilityTimesToBeInserted.filter(
    (availabilityTime) => !existingSchedulesSet.has(`${availabilityTime.name}-${userIntID}`)
  );
  return filteredAvailabilityTimes;
};

//Imports the event types and its corresponding bookings from Calendly
const importEventTypesAndBookings = async (
  userIntID: number,
  cAService: CalendlyAPIService,
  userScheduledEvents: CalendlyScheduledEvent[],
  userEventTypes: CalendlyEventType[]
) => {
  try {
    if (userEventTypes.length === 0) return;

    const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = await getEventScheduler(
      userScheduledEvents,
      cAService.getUserScheduledEventInvitees
    );

    //mapping the scheduled events to its corresponding event type
    const mergedList = await mergeEventTypeAndScheduledEvent(
      userEventTypes as CalendlyEventType[],
      userScheduledEventsWithScheduler as CalendlyScheduledEventWithScheduler[]
    );

    // event types with bookings to be inserted
    const eventTypesAndBookingsToBeInserted: {
      event_type_input: Prisma.EventTypeCreateInput;
      scheduled_events_input: Prisma.BookingCreateInput[];
    }[] = mapEventTypeAndBookingsToInputSchema(mergedList, userIntID);

    //inserting event type and bookings to db via prisma
    const eventTypesAndBookingsInsertedResults = await insertEventTypeAndBookingsToDB(
      eventTypesAndBookingsToBeInserted,
      userIntID
    );

    // Extract booking IDs from each transaction result
    const bookingIds = eventTypesAndBookingsInsertedResults.flatMap((result) =>
      result.createdBookings.map((booking) => booking.id)
    );
    await handleBookingsConfirmation(bookingIds, userIntID);
  } catch (error) {
    console.error("Error importing Calendly data:", error);
    throw error;
  }
};

async function handleBookingsConfirmation(bookingIds: number[], userIntID: number) {
  // Fetching created bookings with desired fields using the extracted IDs
  const createdBookings = await prisma.booking.findMany({
    where: {
      id: {
        in: bookingIds,
      },
    },
    include: {
      eventType: true,
      attendees: true,
      destinationCalendar: true,
    },
  });

  //handle booking confirmation
  const handleBookingConfirmation = async () => {
    const user = await prisma.user.findFirst({
      where: {
        id: userIntID,
      },
      include: {
        destinationCalendar: true,
      },
    });
    if (!user) throw new Error("Event organizer not found");
    // Fetch user credentials and translation
    const [credentials, tOrganizer] = await Promise.all([
      getUsersCredentials(userIntID),
      getTranslation(user.locale ?? "en", "common"),
    ]);
    const userWithCredentials = { ...user, credentials };

    const bookingConfirmationPromises = createdBookings.map(async (booking) => {
      // Retrieving translations for attendees' locales
      const translations = new Map();
      const attendeesListPromises = booking.attendees.map(async (attendee) => {
        const locale = attendee.locale ?? "en";
        let translate = translations.get(locale);
        if (!translate) {
          translate = await getTranslation(locale, "common");
          translations.set(locale, translate);
        }
        return {
          name: attendee.name,
          email: attendee.email,
          timeZone: attendee.timeZone,
          language: { translate, locale },
        };
      });
      const attendeesList = await Promise.all(attendeesListPromises);

      // Construct calendar event
      const evt: CalendarEvent = {
        type: booking?.eventType?.slug as string,
        title: booking.title,
        description: booking.description,
        ...getCalEventResponses({
          bookingFields: booking.eventType?.bookingFields ?? null,
          booking,
        }),
        customInputs: isPrismaObjOrUndefined(booking.customInputs),
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        organizer: {
          email: user.email,
          name: user.name || "Unnamed",
          username: user.username || undefined,
          timeZone: user.timeZone,
          timeFormat: getTimeFormatStringFromUserTimeFormat(user.timeFormat),
          language: { translate: tOrganizer, locale: user.locale ?? "en" },
        },
        location: booking.location,
        attendees: attendeesList,
        uid: booking.uid,
        destinationCalendar: booking?.destinationCalendar
          ? [booking.destinationCalendar]
          : user.destinationCalendar
          ? [user.destinationCalendar]
          : [],
        requiresConfirmation: booking?.eventType?.requiresConfirmation ?? false,
        eventTypeId: booking.eventType?.id,
      };

      // Handle confirmation for the booking
      return handleConfirmation({
        user: userWithCredentials,
        evt: evt,
        prisma: prisma,
        bookingId: booking.id,
        booking: {
          eventType: booking.eventType,
          smsReminderNumber: booking.smsReminderNumber,
          eventTypeId: booking.eventType?.id ?? null,
          userId: userIntID,
        },
      });
    });
    // Processing each booking concurrently
    await Promise.all(bookingConfirmationPromises);
  };

  await handleBookingConfirmation();
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };
  if (!userId) {
    return res.status(400).json({ message: "Missing User ID" });
  }
  const userIntID = parseInt(userId);
  try {
    //Checking if the user has authorized Calendly
    let userCalendlyIntegrationProvider = await prisma.integrationAccounts.findFirst({
      where: {
        userId: userIntID,
        provider: IntegrationProvider.CALENDLY,
      },
    });
    if (!userCalendlyIntegrationProvider) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //Initializing the CalendlyOAuthProvider with the required params
    userCalendlyIntegrationProvider = await refreshTokenIfExpired(userCalendlyIntegrationProvider, userId);
    if (!userCalendlyIntegrationProvider.ownerUniqIdentifier) {
      return res.status(400).json({ message: "Missing User Unique Identifier" });
    }

    await inngestClient.send({
      // The event name
      name: "import-from-calendly",
      // The event's data
      data: {
        userCalendlyIntegrationProvider: {
          accessToken: userCalendlyIntegrationProvider.accessToken,
          refreshToken: userCalendlyIntegrationProvider.refreshToken,
          ownerUniqIdentifier: userCalendlyIntegrationProvider.ownerUniqIdentifier,
        },
        userIntID: userIntID,
      },
    });
    // //Initializing the CalendlyAPIService with the required pakrams
    // await handleCalendlyImportEvent(
    //   {
    //     accessToken: userCalendlyIntegrationProvider.accessToken,
    //     refreshToken: userCalendlyIntegrationProvider.refreshToken,
    //     ownerUniqIdentifier: userCalendlyIntegrationProvider.ownerUniqIdentifier,
    //   },
    //   userIntID
    // );

    return res.status(200).json({ message: "Success" });
  } catch (e) {
    console.error("Error fetching Calendly data:", e);
    return res.status(500).json({ message: "Internal Server Error", error: String(e) });
  }
}
export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
export const handleCalendlyImportEvent = async (
  userCalendlyIntegrationProvider: {
    refreshToken: string;
    accessToken: string;
    ownerUniqIdentifier: string;
  },
  userIntID: number
) => {
  const cAService = new CalendlyAPIService({
    accessToken: userCalendlyIntegrationProvider.accessToken,
    refreshToken: userCalendlyIntegrationProvider.refreshToken,
    clientID: NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    clientSecret: CALENDLY_CLIENT_SECRET ?? "",
    oauthUrl: NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });

  const [userEventTypes, userAvailabilitySchedules, userScheduledEvents] = await fetchCalendlyData(
    userCalendlyIntegrationProvider.ownerUniqIdentifier,
    cAService
  );

  await Promise.all([
    importUserAvailability(userAvailabilitySchedules as CalendlyUserAvailabilitySchedules[], userIntID),
    importEventTypesAndBookings(
      userIntID,
      cAService,
      userScheduledEvents as CalendlyScheduledEvent[],
      userEventTypes as CalendlyEventType[]
    ),
  ]);
};
