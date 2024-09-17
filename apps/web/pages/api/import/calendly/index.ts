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
import { RetryAfterError } from "inngest";
import type { createStepTools } from "inngest/components/InngestStepTools";
import type { NextApiRequest, NextApiResponse } from "next";
import short from "short-uuid";

import dayjs from "@calcom/dayjs";
import { sendImportDataEmail } from "@calcom/emails";
import { sendCampaigningEmail } from "@calcom/emails/email-manager";
import type { CalendlyCampaignEmailProps } from "@calcom/emails/src/templates/CalendlyCampaignEmail";
import type { ImportDataEmailProps } from "@calcom/emails/src/templates/ImportDataEmail";
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
const waitTime = 65000; //1min 5 seconds

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
    const updatedConfig = await updateTokensInDb({
      userId,
      accessToken: freshTokenData.access_token,
      refreshToken: freshTokenData.refresh_token,
      createdAt: freshTokenData.created_at,
      expiresIn: freshTokenData.expires_in,
    });
    userCalendlyIntegrationProvider.accessToken = updatedConfig.accessToken;
    userCalendlyIntegrationProvider.refreshToken = updatedConfig.refreshToken;
    userCalendlyIntegrationProvider.createdAt = updatedConfig.createdAt;
    userCalendlyIntegrationProvider.expiresIn = updatedConfig.expiresIn;
  }
};

//Fetches user data from Calendly including event types, availability schedules and scheduled events
const fetchCalendlyData = async (
  ownerUniqIdentifier: string,
  cAService: CalendlyAPIService,
  step: ReturnType<typeof createStepTools>
): Promise<{
  userScheduledEvents: CalendlyScheduledEvent[];
  userAvailabilitySchedules: CalendlyUserAvailabilitySchedules[];
  userEventTypes: CalendlyEventType[];
}> => {
  try {
    //TODO:as we are only getting past events as of now

    // Define the array of promises
    // const promises = [
    //   cAService.getUserAvailabilitySchedules(ownerUniqIdentifier),
    //   cAService.getUserEventTypes(ownerUniqIdentifier),
    //   cAService.getUserScheduledEvents({
    //     userUri: ownerUniqIdentifier,
    //     maxStartTime: sixHoursBefore,
    //     // minStartTime: new Date().toISOString(),
    //     // status: "active",
    //   }),
    // ];

    const userAvailabilitySchedules = await step.run(
      "Fetch Availability Schedules from Calendly",
      async () => {
        try {
          return await cAService.getUserAvailabilitySchedules(ownerUniqIdentifier);
        } catch (e) {
          throw new RetryAfterError(
            `RetryError - userAvailabilitySchedules: ${e instanceof Error ? e.message : e}`,
            waitTime
          );
        }
      }
    );

    const userEventTypes = await step.run("Fetch Event Types from Calendly", async () => {
      try {
        return await cAService.getUserEventTypes(ownerUniqIdentifier);
      } catch (e) {
        throw new RetryAfterError(
          `RetryError - userEventTypes: ${e instanceof Error ? e.message : e}`,
          waitTime
        );
      }
    });

    const userScheduledEvents = await step.run("Fetch Scheduled Events from Calendly", async () => {
      try {
        const sixHoursBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

        return await cAService.getUserScheduledEvents({
          userUri: ownerUniqIdentifier,
          maxStartTime: sixHoursBefore.replace(/(\.\d{3})Z$/, "$1000Z"),
          // minStartTime: new Date().toISOString(),
          // status: "active",
        });
      } catch (e) {
        throw new RetryAfterError(
          `RetryError - userScheduledEvents: ${e instanceof Error ? e.message : e}`,
          waitTime
        );
      }
    });

    // // Wait for all promises to complete
    // const results = await Promise.all(promises);

    // Return the results if successful
    return {
      userScheduledEvents,
      userAvailabilitySchedules,
      userEventTypes,
    };
  } catch (error) {
    console.error("Error - fetchCalendlyData:", error instanceof Error ? error.message : String(error));
    throw new Error(`Error - fetchCalendlyData: ${error instanceof Error ? error.message : error}`);
  }
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
      //for dates each date should have a separate object no matter if the interval is same, so we form the key using the date and interval
      combinedIntervals[`${rule.date}-${key}`] = {
        type: "date",
        interval: ruleWInterval,
        date: new Date(rule.date),
      };
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
  ) => Promise<CalendlyScheduledEventInvitee[]>,
  step: ReturnType<typeof createStepTools>
): Promise<CalendlyScheduledEventWithScheduler[]> => {
  const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = [];

  const currentTime = new Date();
  for (const userScheduledEvent of userScheduledEvents) {
    const uuid = userScheduledEvent.uri.substring(userScheduledEvent.uri.lastIndexOf("/") + 1);
    const invitees = await step.run("Get booking invitees", async () => {
      try {
        return await getUserScheduledEventInvitees(uuid);
      } catch (e) {
        throw new RetryAfterError(
          `RetryError - getEventScheduler: ${e instanceof Error ? e.message : e}`,
          waitTime
        );
      }
    });

    //TODO:I think we do not need to run the step again as inngest will handle the retry itself
    // invitees = await step.run("Get booking invitees", async () => {
    //   return await getUserScheduledEventInvitees(uuid);
    // });
    // TODO: check if the error is 429
    // if (e instanceof StepError && (e.cause as any)?.response?.status === 429) {
    //   throw new RetryAfterError("Wait before retry to avoid api call limit exceed", waitTime);

    //   // await step.sleep("wait to avoid api call limit exceed", waitTime);
    //   // invitees = await step.run("Get booking invitees", async () => {
    //   //   return await getUserScheduledEventInvitees(uuid);
    //   // });
    // } else throw new NonRetriableError("Failed to get booking invitees", { cause: e });

    const scheduled_by = invitees[0] || null;
    // const isPastBooking =
    //   userScheduledEvent.status === "active" && new Date(userScheduledEvent.end_time) < currentTime;
    if (scheduled_by?.payment === undefined || scheduled_by?.payment === null) {
      userScheduledEventsWithScheduler.push({
        ...userScheduledEvent,
        scheduled_by,
      });
    }
  }

  // for (const userScheduledEvent of userScheduledEvents) {
  //   const uuid = userScheduledEvent.uri.substring(userScheduledEvent.uri.lastIndexOf("/") + 1);
  //   let invitees;
  //   try {
  //     invitees = await getUserScheduledEventInvitees(uuid);
  //   } catch (e: any) {
  //     if (e.response && e.response.status === 429) {
  //       await step.sleep("wait to avoid api call limit exceed", waitTime);
  //       invitees = await getUserScheduledEventInvitees(uuid);
  //     } else throw new NonRetriableError("Failed to get booking invitees", { cause: e });
  //   }

  //   const scheduled_by = invitees[0] || null;

  //   if (scheduled_by?.payment === undefined || scheduled_by?.payment === null) {
  //     userScheduledEventsWithScheduler.push({
  //       ...userScheduledEvent,
  //       scheduled_by,
  //     });
  //   }
  // }

  return userScheduledEventsWithScheduler;
};

//Merges the scheduled events with its corresponding event types while checking for overlapping bookings
const mergeEventTypeAndScheduledEvent = async (
  eventTypeList: CalendlyEventType[],
  scheduledEventList: CalendlyScheduledEventWithScheduler[],
  userIntID: number
): Promise<EventTypeWithScheduledEvent[]> => {
  try {
    const scheduledEventsMap: Record<string, CalendlyScheduledEventWithScheduler[]> = {};

    const overlappingEvent = await Promise.all(
      scheduledEventList.map((scheduledEvent) => doesBookingOverlap(scheduledEvent, userIntID))
    );

    scheduledEventList.map((scheduledEvent, index) => {
      const eventTypeURI = scheduledEvent.event_type;

      if (!scheduledEventsMap[eventTypeURI]) {
        scheduledEventsMap[eventTypeURI] = [];
      }

      const isOverlapping = !!overlappingEvent[index];
      if (!isOverlapping) {
        scheduledEventsMap[eventTypeURI].push(scheduledEvent);
      }
    });

    return eventTypeList.map((eventType) => ({
      event_type: eventType,
      scheduled_events: scheduledEventsMap[eventType.uri] || [],
    }));
  } catch (error) {
    console.error(
      "Error - mergeEventTypeAndScheduledEvent :",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      `Error - mergeEventTypeAndScheduledEvent : ${error instanceof Error ? error.message : error}`
    );
  }
};

//Checks if the booking overlaps with the existing bookings
const doesBookingOverlap = (userScheduledEvent: CalendlyScheduledEvent, userIntID: number) => {
  return prisma.booking.findFirst({
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
        { userId: userIntID },
      ],
    },
  });
};

//Returns the datetime ISO string from the time
const getDateTimeISOString = (time: string) => {
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
  try {
    // Map the userAvailabilitySchedules to Prisma input format
    const parsedUserAvailabilitySchedules: Prisma.ScheduleCreateInput[] = (
      userAvailabilitySchedules as CalendlyUserAvailabilitySchedules[]
    ).map((availabilitySchedule) => {
      const d: Prisma.ScheduleCreateInput = {
        user: { connect: { id: userIntID } },
        name: availabilitySchedule.name ?? "N/A",
        timeZone: availabilitySchedule.timezone,
        availability: {
          create: combinedRules(availabilitySchedule.rules).map((rule) => {
            return {
              startTime: getDateTimeISOString(rule.interval.from),
              endTime: getDateTimeISOString(rule.interval.to),
              days: rule.wdays,
              date: rule.date,
              userId: userIntID,
            };
          }),
        },
      };

      return d;
    });

    // Retrieve  availability schedules to be inserted in DB
    const newAvailabilitySchedules = await getNewAvailabilitySchedules(
      userIntID,
      parsedUserAvailabilitySchedules
    );

    // Create schedules in the database
    return await Promise.all(
      newAvailabilitySchedules.map((scheduleInput) =>
        prisma.schedule.create({
          data: scheduleInput,
        })
      )
    );
  } catch (error) {
    console.error("Error - importUserAvailability:", error instanceof Error ? error.message : String(error));
    throw new Error(`Error - importUserAvailability: ${error instanceof Error ? error.message : error}`);
  }
};

const handleBookingLocation = (
  location: CalendlyScheduledEventLocation
): {
  location: string;
  videoCallUrl?: string;
} => {
  switch (location.type) {
    case "physical":
      return {
        location: `In Person Meeting\nAt ${location.location}`,
      };

    case "outbound_call":
      return {
        location: `Phone Call\nGuest's contact number ${location.location}`,
      };
    case "inbound_call":
      return {
        location: `Phone Call\nHost's contact number ${location.location}`,
      };
    case "custom":
    case "ask_invitee":
      return {
        location: String(location.location),
      };
    case "google_conference":
      return {
        location: "integrations:google:meet",
        videoCallUrl: location.join_url,
      };
    case "zoom":
      return {
        location: "integrations:zoom",
        videoCallUrl: location.join_url,
      };

    case "microsoft_teams_conference":
      return {
        location: "integrations:office365_video",
        videoCallUrl: location.join_url,
      };
    case "webex_conference":
      return {
        location: "integrations:webex_video",
        videoCallUrl: location.join_url,
      };
    // case "gotomeeting":
    //   return {
    //     location: "integrations:google:meet",
    //     videoCallUrl: location.join_url,
    //   };
    default: //location type not specified
      return {
        location: "",
      };
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
        const loc = handleBookingLocation(scheduledEvent.location);
        const metadata = { isImported: "yes" };
        return {
          uid: short.uuid(),
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
          location: loc.location,
          createdAt: new Date(scheduledEvent.created_at),
          updatedAt: new Date(scheduledEvent.updated_at),
          status: scheduledEvent.status === "canceled" ? BookingStatus.CANCELLED : BookingStatus.ACCEPTED,
          ...(scheduledEvent.status === "canceled" && {
            cancellationReason: scheduledEvent.cancellation?.reason,
          }),
          metadata: {
            ...metadata,
            ...(loc.videoCallUrl && { videoCallUrl: loc.videoCallUrl }),
          },
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
  try {
    // Create an array of promises for each event type and bookings
    const eventTypesAndBookingsInsertionPromises = [];
    for (const eventTypeAndBooking of eventTypesAndBookingsToBeInserted) {
      eventTypesAndBookingsInsertionPromises.push(
        (async () => {
          const { event_type_input, scheduled_events_input } = eventTypeAndBooking;

          try {
            // Perform the eventType upsert
            const upsertedEventType = await prisma.eventType.upsert({
              create: event_type_input,
              update: {},
              where: {
                userId_slug: {
                  userId: userIntID,
                  slug: event_type_input.slug,
                },
              },
            });

            // Create bookings only after the upsert is complete
            const bookingPromises = scheduled_events_input.map((scheduledEvent) => {
              return prisma.booking.create({
                data: {
                  ...scheduledEvent,
                  eventType: { connect: { id: upsertedEventType.id } },
                },
                //TODO:was needed for future bookings but currently we have removed importing future bookings
                // include: {
                //   eventType: {
                //     select: {
                //       slug: true,
                //       bookingFields: true,
                //       requiresConfirmation: true,
                //       id: true,
                //     },
                //   },
                //   attendees: {
                //     select: {
                //       locale: true,
                //       name: true,
                //       email: true,
                //       timeZone: true,
                //     },
                //   },
                //   destinationCalendar: true,
                // },
              });
            });

            // Wait for all booking creations to complete
            const createdBookings = await Promise.all(bookingPromises);
            return { upsertedEventType, createdBookings };
          } catch (innerError) {
            console.error("Error inserting/updating event type or bookings:", innerError);
            throw innerError; // Rethrow the error to be caught by the outer catch block
          }
        })()
      );
    }

    // Wait for all event type and booking insertion promises to complete
    const eventTypesAndBookingsInsertedResults = await Promise.all(eventTypesAndBookingsInsertionPromises);
    return eventTypesAndBookingsInsertedResults;
  } catch (error) {
    console.error(
      "Error - insertEventTypeAndBookingsToDB :",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      `Error - insertEventTypeAndBookingsToDB : ${error instanceof Error ? error.message : error}`
    );
  }
};

//Returns the availability schedules to be inserted (not currently existing in DB)
const getNewAvailabilitySchedules = async (
  userIntID: number,
  availabilitySchedules: Prisma.ScheduleCreateInput[]
): Promise<Prisma.ScheduleCreateInput[]> => {
  try {
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        user: { id: userIntID },
        name: { in: availabilitySchedules.map((schedule) => schedule.name) },
      },
      select: {
        name: true,
        userId: true,
      },
    });

    const existingSchedulesSet = new Set(
      existingSchedules.map((existing) => `${existing.name}-${existing.userId}`)
    );
    const newAvailabilitySchedules = availabilitySchedules.filter(
      (schedule) => !existingSchedulesSet.has(`${schedule.name}-${userIntID}`)
    );
    return newAvailabilitySchedules;
  } catch (error) {
    //throw error to parent function
    throw error;
  }
};

//Imports the event types and its corresponding bookings in DB
const importEventTypesAndBookings = async (
  userIntID: number,
  cAService: CalendlyAPIService,
  userScheduledEvents: CalendlyScheduledEvent[],
  userEventTypes: CalendlyEventType[],
  step: ReturnType<typeof createStepTools>
) => {
  try {
    if (userEventTypes.length === 0) return;

    const userScheduledEventsWithScheduler: CalendlyScheduledEventWithScheduler[] = await getEventScheduler(
      userScheduledEvents,
      cAService.getUserScheduledEventInvitees,
      step
    );

    //mapping the scheduled events to its corresponding event type
    const mergedList = await step.run(
      "Map bookings to its event type",
      async () =>
        await mergeEventTypeAndScheduledEvent(
          userEventTypes as CalendlyEventType[],
          userScheduledEventsWithScheduler as CalendlyScheduledEventWithScheduler[],
          userIntID
        )
    );

    // event types with bookings to be inserted
    const eventTypesAndBookingsToBeInserted = mapEventTypeAndBookingsToInputSchema(mergedList, userIntID);

    //inserting event type and bookings to db via prisma
    const eventTypesAndBookingsInsertedResults = await step.run(
      "Insert event type and bookings to DB",
      async () => await insertEventTypeAndBookingsToDB(eventTypesAndBookingsToBeInserted, userIntID)
    );

    //TODO:we will not import future bookings as of now
    // // Extract booking IDs from each transaction result
    // const currentTime = new Date();
    // const allCreatedBookings = eventTypesAndBookingsInsertedResults
    //   .flatMap((result) => result.createdBookings)
    //   .reduce((acc: any[], booking) => {
    //     if (booking.status === BookingStatus.ACCEPTED && new Date(booking.startTime) > currentTime) {
    //       acc.push(booking);
    //     }
    //     return acc;
    //   }, []);

    // // const bookingIds = eventTypesAndBookingsInsertedResults
    // //   .flatMap((result) => result.createdBookings)
    // //   .reduce((acc: number[], booking) => {
    // // if (booking.status === BookingStatus.ACCEPTED && new Date(booking.startTime) > currentTime) {
    // //   acc.push(booking.id);
    // // }
    // //     return acc;
    // //   }, []);

    // await step.run(
    //   "Confirm bookings",
    //   async () => await confirmUpcomingImportedBookings(allCreatedBookings, userIntID)
    // );
  } catch (error) {
    console.error(
      "Error - importEventTypesAndBookings :",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      `Error - importEventTypesAndBookings : ${error instanceof Error ? error.message : error}`
    );
  }
};

async function confirmUpcomingImportedBookings(createdBookings: any[], userIntID: number) {
  try {
    // Fetching created bookings with desired fields using the extracted IDs
    // const createdBookings = await prisma.booking.findMany({
    //   where: {
    //     id: {
    //       in: bookingIds,
    //     },
    //   },
    //   include: {
    //     eventType: true,
    //     attendees: true,
    //     destinationCalendar: true,
    //   },
    // });

    //handle booking confirmation
    const handleBookingsConfirmation = async () => {
      try {
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
          getUsersCredentials(user),
          getTranslation(user.locale ?? "en", "common"),
        ]);
        const userWithCredentials = { ...user, credentials };

        const bookingConfirmationPromises = createdBookings.map(async (booking) => {
          // Retrieving translations for attendees' locales
          const translations = new Map();
          const attendeesListPromises = booking.attendees.map(async (attendee: any) => {
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
      } catch (innerError) {
        console.error("Error handling bookings confirmation:", innerError);
        throw innerError; // Rethrow the error to be caught by the outer catch block
      }
    };

    await handleBookingsConfirmation();
  } catch (error) {
    console.error(
      "Error - confirmUpcomingImportedBookings:",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      `Error - confirmUpcomingImportedBookings: ${error instanceof Error ? error.message : error}`
    );
  }
}
async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query as { userId: string };
  if (!userId) {
    return res.status(400).json({ message: "Missing User ID" });
  }
  const userIntID = parseInt(userId);
  try {
    //Checking if the user has authorized Calendly
    const userCalendlyIntegrationProvider = await prisma.integrationAccounts.findFirst({
      where: {
        userId: userIntID,
        provider: IntegrationProvider.CALENDLY,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            locale: true,
            username: true,
          },
        },
      },
    });
    if (!userCalendlyIntegrationProvider) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    //Initializing the CalendlyOAuthProvider with the required params
    await refreshTokenIfExpired(userCalendlyIntegrationProvider, userId);

    if (!userCalendlyIntegrationProvider.ownerUniqIdentifier) {
      return res.status(400).json({ message: "Missing User Unique Identifier" });
    }

    await inngestClient.send({
      name: "import-from-calendly",
      data: {
        userCalendlyIntegrationProvider: {
          accessToken: userCalendlyIntegrationProvider.accessToken,
          refreshToken: userCalendlyIntegrationProvider.refreshToken,
          ownerUniqIdentifier: userCalendlyIntegrationProvider.ownerUniqIdentifier,
        },
        user: {
          id: userIntID,
          name: userCalendlyIntegrationProvider.user.name,
          email: userCalendlyIntegrationProvider.user.email,
          slug: userCalendlyIntegrationProvider.user.username,
        },
      },
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

export const handleCalendlyImportEvent = async (
  userCalendlyIntegrationProvider: {
    refreshToken: string;
    accessToken: string;
    ownerUniqIdentifier: string;
  },
  user: {
    id: number;
    name: string;
    email: string;
    slug: string;
  },
  step: ReturnType<typeof createStepTools>
) => {
  try {
    const cAService = new CalendlyAPIService({
      accessToken: userCalendlyIntegrationProvider.accessToken,
      refreshToken: userCalendlyIntegrationProvider.refreshToken,
      clientID: NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
      clientSecret: CALENDLY_CLIENT_SECRET ?? "",
      oauthUrl: NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
    });

    //0. Getting user data from calendly
    const { userAvailabilitySchedules, userEventTypes, userScheduledEvents } = await fetchCalendlyData(
      userCalendlyIntegrationProvider.ownerUniqIdentifier,
      cAService,
      step
    );
    // const { userAvailabilitySchedules, userEventTypes, userScheduledEvents } = await step.run(
    //   "Fetch Data from Calendly",
    //   async () =>
    // );

    //run sequentially to ensure proper import of entire dataset
    //1.First importing the user availability schedules
    await step.run(
      "Import user availability schedules",
      async () =>
        await importUserAvailability(
          userAvailabilitySchedules as CalendlyUserAvailabilitySchedules[],
          user.id
        )
    );

    //2. Then importing the user event types and bookings
    await importEventTypesAndBookings(
      user.id,
      cAService,
      userScheduledEvents as CalendlyScheduledEvent[],
      userEventTypes as CalendlyEventType[],
      step
    );

    //3. Notifying the user about the import status
    await step.run("Notify user", async () => {
      const data: ImportDataEmailProps = {
        status: true,
        provider: "Calendly",
        user: {
          email: user.email,
          name: user.name,
        },
      };
      await sendImportDataEmail(data);
    });

    //4. Sending campaign emails to Calendly user scheduled events bookers
    await sendCampaigningEmails(
      {
        fullName: user.name,
        slug: user.slug,
        emails: (userScheduledEvents as CalendlyScheduledEvent[]).reduce((acc, event) => {
          if (event.event_guests) {
            acc.push(...event.event_guests.map((guest) => guest.email));
          }
          return acc;
        }, [] as string[]),
      },
      step
    );
  } catch (e) {
    console.error("Error importing Calendly data:", e);
    await step.run("Notify user", async () => {
      const data: ImportDataEmailProps = {
        status: false,
        provider: "Calendly",
        user: {
          email: user.email,
          name: user.name,
        },
      };
      await sendImportDataEmail(data);
    });
  }
};

const sendCampaigningEmails = async (
  { fullName, slug, emails }: { fullName: string; slug: string; emails: string[] },
  step: ReturnType<typeof createStepTools>
) => {
  const name = fullName.includes("@") ? fullName.split("@")[0] : fullName;
  for (let i = 0; i < emails.length; i += 10) {
    const batch = emails.slice(i, i + 10);
    await step.run(`Email Campaigning Batch ${i + 1}`, async () => {
      await Promise.all(
        batch.map((batchEmail) =>
          sendBatchEmail({
            fullName: name,
            slug,
            email: batchEmail,
          })
        )
      );
    });
  }
};

const sendBatchEmail = async ({
  fullName,
  slug,
  email,
}: {
  fullName: string;
  slug: string;
  email: string;
}) => {
  const data: CalendlyCampaignEmailProps = {
    receiverEmail: email,
    user: {
      fullName,
      slug,
    },
  };
  await sendCampaigningEmail(data);
};
