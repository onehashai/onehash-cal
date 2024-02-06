import type {
  CalendlyEventType,
  CalendlyScheduledEvent,
  CalendlyScheduledEventInvitee,
  CalendlyUserAvailabilityRules,
  CalendlyUserAvailabilitySchedules,
} from "@onehash/calendly";
import { CalendlyAPIService, CalendlyOAuthProvider } from "@onehash/calendly";
import type { NextApiRequest, NextApiResponse } from "next";

import { defaultHandler, defaultResponder } from "@calcom/lib/server";
import prisma from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { BookingStatus, IntegrationProvider, SchedulingType } from "@calcom/prisma/client";

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
  promises.push(cAService.getUserScheduledEvents(ownerUniqIdentifier));

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
  userScheduledEvents: CalendlyEventType[] | CalendlyUserAvailabilitySchedules[] | CalendlyScheduledEvent[],
  getUserScheduledEventInvitees: (
    uuid: string,
    count?: number,
    pageToken?: string | undefined
  ) => Promise<CalendlyScheduledEventInvitee[]>
): Promise<CalendlyScheduledEventWithScheduler[]> => {
  const uuids = (userScheduledEvents as CalendlyScheduledEvent[]).map((userScheduledEvent) =>
    userScheduledEvent.uri.substring(userScheduledEvent.uri.lastIndexOf("/") + 1)
  );

  const scheduledEventInviteesByUUID = await Promise.all(
    uuids.map((uuid) => getUserScheduledEventInvitees(uuid))
  );

  const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = (
    userScheduledEvents as CalendlyScheduledEvent[]
  ).map((userScheduledEvent, index) => ({
    ...userScheduledEvent,
    scheduled_by: scheduledEventInviteesByUUID[index][0] || null,
  }));
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
const getDatetimeObjectFromTime = (time: string, timezone: string): Date => {
  const [hours, minutes] = time.split(":").map(Number); // Convert to numbers
  const currentDate = new Date();
  currentDate.setUTCHours(hours);
  currentDate.setUTCMinutes(minutes);
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour12: false,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  };
  const dateTimeWithTimeZone = new Intl.DateTimeFormat("en-US", formatOptions).format(currentDate);
  const date = new Date(dateTimeWithTimeZone);
  return date;
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
  const timezone = scheduledEvent.scheduled_by?.timezone ?? getServerTimezone(); //using the scheduled_by timezone if available else using the server timezone
  const scheduledByAttendee: Prisma.AttendeeCreateWithoutBookingSeatInput = {
    name: scheduledEvent.scheduled_by?.name ?? "N/A",
    email: scheduledEvent.scheduled_by?.email ?? "N/A",
    timeZone: timezone,
  };

  const eventMembershipAttendees: Prisma.AttendeeCreateWithoutBookingSeatInput[] =
    scheduledEvent.event_memberships.map((event_membership) => ({
      name: event_membership.user_name ?? "N/A",
      email: event_membership.user_email ?? "N/A",
      timeZone: timezone,
    }));

  return [scheduledByAttendee, ...eventMembershipAttendees];
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
          console.log("combinedRules", rule);
          return {
            startTime: getDatetimeObjectFromTime(rule.interval.from, availabilitySchedule.timezone),
            endTime: getDatetimeObjectFromTime(rule.interval.to, availabilitySchedule.timezone),
            days: rule.type === "wday" ? rule.wdays : undefined,
            date: rule.type === "date" ? rule.date : undefined,
            userId: userIntID,
          };
        }),
      },
    };

    return d;
  });

  console.log("userAvailabilityTimesToBeInserted", userAvailabilityTimesToBeInserted);

  const filteredAvailabilityTimes = await getUniqueAvailabilityTimes(
    userIntID,
    userAvailabilityTimesToBeInserted
  );

  const createdAvailability = await Promise.all(
    filteredAvailabilityTimes.map((availabilityTime) =>
      prisma.schedule.create({
        data: availabilityTime,
      })
    )
  );

  console.log("createdAvailability", createdAvailability);
};

//Maps the scheduled events with its corresponding event types and returns the event types to be inserted
const fetchEventTypesToBeInserted = (
  mergedList: EventTypeWithScheduledEvent[],
  userIntID: number
): Prisma.EventTypeCreateInput[] => {
  return mergedList.map((mergedItem) => {
    const { event_type, scheduled_events } = mergedItem;
    const d: Prisma.EventTypeCreateInput = {
      title: event_type.name,
      slug: event_type.slug,
      description: event_type.description_plain,
      length: event_type.duration,
      hidden: event_type.secret,
      owner: { connect: { id: userIntID } },
      users: { connect: { id: userIntID } },
    };
    if (scheduled_events.length > 0) {
      d.bookings = {
        create: scheduled_events.map((scheduledEvent) => {
          const eventId = scheduledEvent.uri.substring(scheduledEvent.uri.lastIndexOf("/") + 1);
          return {
            uid: eventId,
            userId: userIntID,
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
            location:
              scheduledEvent.location.type === "physical"
                ? `${scheduledEvent.location.type} @ ${scheduledEvent.location.location}`
                : scheduledEvent.location.join_url,
            createdAt: new Date(scheduledEvent.created_at),
            updatedAt: new Date(scheduledEvent.updated_at),
            status: scheduledEvent.status === "canceled" ? BookingStatus.CANCELLED : BookingStatus.ACCEPTED,
            ...(scheduledEvent.status === "canceled" && {
              cancellationReason: scheduledEvent.cancellation?.reason,
            }),
          };
        }),
      };
    }
    if (event_type.pooling_type === "collective") {
      d.schedulingType = SchedulingType.COLLECTIVE;
    } else if (event_type.pooling_type === "round_robin") {
      d.schedulingType = SchedulingType.ROUND_ROBIN;
    }
    return d;
  });
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

  console.log("existingSchedules", existingSchedules);
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
  const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = await getEventScheduler(
    userScheduledEvents,
    cAService.getUserScheduledEventInvitees
  );

  //mapping the scheduled events to its corresponding event type
  const mergedList = await mergeEventTypeAndScheduledEvent(
    userEventTypes as CalendlyEventType[],
    userScheduledEventsWithScheduler as CalendlyScheduledEventWithScheduler[]
  );

  console.log("mergedList", mergedList);

  // importing userEventTypes to our db
  const eventTypesToBeInserted: Prisma.EventTypeCreateInput[] = fetchEventTypesToBeInserted(
    mergedList,
    userIntID
  );

  eventTypesToBeInserted.forEach(async (eventType) => {
    const addedEvent = await prisma.eventType.upsert({
      create: eventType,
      update: {},
      where: {
        userId_slug: {
          userId: userIntID,
          slug: eventType.slug,
        },
      },
    });
    console.log("addedEvent", addedEvent);
  });
};

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

    //Initializing the CalendlyAPIService with the required params
    const cAService = new CalendlyAPIService({
      accessToken: userCalendlyIntegrationProvider.accessToken,
      refreshToken: userCalendlyIntegrationProvider.refreshToken,
      clientID: NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: CALENDLY_CLIENT_SECRET ?? "",
      oauthUrl: NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
    });

    if (!userCalendlyIntegrationProvider.ownerUniqIdentifier) {
      return res.status(400).json({ message: "Missing User Unique Identifier" });
    }
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

    return res.status(200).json({ message: "Success" });
  } catch (e) {
    console.error("Error fetching Calendly data:", e);
    return res.status(500).json({ message: "Internal Server Error", error: String(e) });
  }
}
export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
