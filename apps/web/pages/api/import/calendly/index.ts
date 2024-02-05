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

//maps the weekday to its corresponding number
const wdayMapping: { [key: string]: number } = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

//updates the fresh tokens in db
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

//Merges the scheduled events with its corresponding event types while checking for overlapping bookings
const mergeEventTypeAndScheduledEvent = async (
  eventTypeList: CalendlyEventType[],
  scheduledEventList: CalendlyScheduledEventWithScheduler[]
): Promise<EventTypeWithScheduledEvent[]> => {
  const scheduledEventsMap: Record<string, CalendlyScheduledEventWithScheduler[]> = {};

  await Promise.all(
    scheduledEventList.map(async (scheduledEvent) => {
      const eventTypeURI = scheduledEvent.event_type;

      if (eventTypeURI) {
        if (!scheduledEventsMap[eventTypeURI]) {
          scheduledEventsMap[eventTypeURI] = [];
        }

        const isOverlapping = await doesBookingOverlap(scheduledEvent);
        if (!isOverlapping) {
          scheduledEventsMap[eventTypeURI].push(scheduledEvent);
        }
      }
    })
  );

  return eventTypeList.map((eventType) => ({
    event_type: eventType,
    scheduled_events: scheduledEventsMap[eventType.uri] || [],
  }));
};

//checks if the booking overlaps with the existing bookings
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

//returns the datetime object from the time and timezone
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

//returns the server timezone
const getServerTimezone = (): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone;
};

//returns the attendees with timezone
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

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };
  if (!userId) {
    return res.status(400).json({ message: "Missing User ID" });
  }
  const userIntID = parseInt(userId);
  try {
    //Checking if the user has calendly integration enabled
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
    const cOService = new CalendlyOAuthProvider({
      clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: process.env.CALENDLY_CLIENT_SECRET ?? "",
      redirectUri: process.env.NEXT_PUBLIC_CALENDLY_REDIRECT_URI ?? "",
      oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
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

    //Initializing the CalendlyAPIService with the required params
    const cAService = new CalendlyAPIService({
      accessToken: userCalendlyIntegrationProvider.accessToken,
      refreshToken: userCalendlyIntegrationProvider.refreshToken,
      clientID: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: process.env.CALENDLY_CLIENT_SECRET ?? "",
      oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
    });

    //list of promises
    const promises = [];
    if (userCalendlyIntegrationProvider.ownerUniqIdentifier) {
      // promises.push(cAService.getUserInfo());
      promises.push(cAService.getUserEventTypes(userCalendlyIntegrationProvider.ownerUniqIdentifier));
      promises.push(
        cAService.getUserAvailabilitySchedules(userCalendlyIntegrationProvider.ownerUniqIdentifier)
      );
      promises.push(cAService.getUserScheduledEvents(userCalendlyIntegrationProvider.ownerUniqIdentifier));
    }

    const [
      // user,
      userEventTypes,
      userAvailabilitySchedules,
      userScheduledEvents,
    ] = await Promise.all(promises);

    //fetching user availability times

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
            };
          }),
        },
      };

      return d;
    });

    console.log("userAvailabilityTimesToBeInserted", userAvailabilityTimesToBeInserted);

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

    // Create schedules in parallel for non-existing ones
    await Promise.all(
      userAvailabilityTimesToBeInserted
        .filter(
          (availabilityTime) =>
            !existingSchedules.some(
              (existing) => existing.name === availabilityTime.name && existing.userId === userIntID
            )
        )
        .map(async (availabilityTime) => {
          const addedAvailability = await prisma.schedule.create({
            data: availabilityTime,
          });
          console.log("addedAvailability", addedAvailability);
        })
    );

    //fetching scheduled event invitees

    const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = await Promise.all(
      (userScheduledEvents as CalendlyScheduledEvent[]).map(async (userScheduledEvent) => {
        const uuid = userScheduledEvent.uri.substring(userScheduledEvent.uri.lastIndexOf("/") + 1);
        const scheduledEventInvitees = await cAService.getUserScheduledEventInvitees(uuid);

        return {
          ...userScheduledEvent,
          scheduled_by: scheduledEventInvitees[0] || null,
        };
      })
    );

    const mergedList = await mergeEventTypeAndScheduledEvent(
      userEventTypes as CalendlyEventType[],
      userScheduledEventsWithScheduler as CalendlyScheduledEventWithScheduler[]
    );

    console.log("mergedList", mergedList);

    // importing userEventTypes to our db
    const eventTypesToBeInserted: Prisma.EventTypeCreateInput[] = mergedList.map((mergedItem) => {
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

    return res.status(200).json({ message: "Success" });
  } catch (e) {
    console.error("Error fetching Calendly data:", e);
    return res.status(500).json({ message: "Internal Server Error", error: String(e) });
  }
}
export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
