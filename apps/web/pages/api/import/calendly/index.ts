import type {
  CalendlyEventType,
  CalendlyScheduledEvent,
  CalendlyScheduledEventInvitee,
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
type Attendee = {
  name: string;
  email: string;
  timeZone: string;
};

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

function mergeEventTypeAndScheduledEvent(
  eventTypeList: CalendlyEventType[],
  scheduledEventList: CalendlyScheduledEventWithScheduler[]
): EventTypeWithScheduledEvent[] {
  const scheduledEventsMap: Record<string, CalendlyScheduledEventWithScheduler[]> = {};

  scheduledEventList.forEach((scheduledEvent) => {
    const eventTypeURI = scheduledEvent.event_type;

    if (eventTypeURI) {
      if (!scheduledEventsMap[eventTypeURI]) {
        scheduledEventsMap[eventTypeURI] = [];
      }

      scheduledEventsMap[eventTypeURI].push(scheduledEvent);
    }
  });

  return eventTypeList.map((eventType) => ({
    event_type: eventType,
    scheduled_events: scheduledEventsMap[eventType.uri] || [],
  }));
}

const getAttendeesWithTimezone = (scheduledEvent: CalendlyScheduledEventWithScheduler): Attendee[] => {
  const timezone = scheduledEvent.scheduled_by?.timezone ?? "Asia/Calcutta";
  const scheduledByAttendee: Attendee = {
    name: scheduledEvent.scheduled_by?.name ?? "N/A",
    email: scheduledEvent.scheduled_by?.email ?? "N/A",
    timeZone: timezone,
  };

  const eventMembershipAttendees: Attendee[] = scheduledEvent.event_memberships.map((event_membership) => ({
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

  //Checking if the user has calendly integration enabled
  let userCalendlyIntegrationProvider = await prisma.integrationAccounts.findFirst({
    where: {
      userId: parseInt(userId),
      provider: IntegrationProvider.CALENDLY,
    },
  });
  if (!userCalendlyIntegrationProvider) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  //Initializing the CalendlyOAuthProvider with the required params
  const cOService = new CalendlyOAuthProvider({
    clientId: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_ID ?? "",
    clientSecret: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET ?? "",
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
    clientSecret: process.env.NEXT_PUBLIC_CALENDLY_CLIENT_SECRET ?? "",
    oauthUrl: process.env.NEXT_PUBLIC_CALENDLY_OAUTH_URL ?? "",
  });

  //list of promises
  const promises = [];
  if (userCalendlyIntegrationProvider.ownerUniqIdentifier) {
    // promises.push(cAService.getUserInfo());
    promises.push(cAService.getUserEventTypes(userCalendlyIntegrationProvider.ownerUniqIdentifier));
    // promises.push(
    //   cAService.getUserAvailabilitySchedules(userCalendlyIntegrationProvider.ownerUniqIdentifier)
    // );
    promises.push(cAService.getUserScheduledEvents(userCalendlyIntegrationProvider.ownerUniqIdentifier));
  }

  const [
    // user,
    userEventTypes,
    //userAvailabilitySchedules
    userScheduledEvents,
  ] = await Promise.all(promises);

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

  const mergedList = mergeEventTypeAndScheduledEvent(
    userEventTypes as CalendlyEventType[],
    userScheduledEventsWithScheduler as CalendlyScheduledEventWithScheduler[]
  );

  // //Depends on use case if we want to add this check or not
  // const overlappingBookingsResolved = await Promise.all(
  //   (userScheduledEvents as CalendlyScheduledEvent[]).map(async (userScheduledEvent) => {
  //     return await prisma.booking.findFirst({
  //       where: {
  //         AND: [
  //           {
  //             OR: [
  //               {
  //                 AND: [
  //                   { startTime: { gte: userScheduledEvent.start_time } },
  //                   { startTime: { lte: userScheduledEvent.end_time } },
  //                 ],
  //               },
  //               {
  //                 AND: [
  //                   { startTime: { lte: userScheduledEvent.start_time } },
  //                   { endTime: { gte: userScheduledEvent.start_time } },
  //                 ],
  //               },
  //             ],
  //           },
  //           {
  //             AND: [
  //               {
  //                 status: BookingStatus.CANCELLED,
  //               },
  //               {
  //                 status: BookingStatus.REJECTED,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     });
  //   })
  // );
  // // console.log("overlappingBookingsResolved:", overlappingBookingsResolved);

  // importing userEventTypes to our db
  const eventTypesToBeInserted: Prisma.EventTypeCreateInput[] = mergedList.map((mergedItem) => {
    const { event_type, scheduled_events } = mergedItem;
    const d: Prisma.EventTypeCreateInput = {
      title: event_type.name,
      slug: event_type.slug,
      description: event_type.description_plain,
      length: event_type.duration,
      hidden: event_type.secret,
      owner: { connect: { id: parseInt(userId) } },
      users: { connect: { id: parseInt(userId) } },
    };
    if (scheduled_events.length > 0) {
      d.bookings = {
        create: scheduled_events.map((scheduledEvent) => {
          const eventId = scheduledEvent.uri.substring(scheduledEvent.uri.lastIndexOf("/") + 1);
          return {
            uid: eventId,
            userId: parseInt(userId),
            title: `${scheduledEvent.name} between ${scheduledEvent.scheduled_by?.name} and ${scheduledEvent.event_memberships[0].user_name}`,
            responses: {
              name: scheduledEvent.scheduled_by?.name ?? "N/A",
              email: scheduledEvent.scheduled_by?.email ?? "N/A",
              guests: scheduledEvent.event_guests,
            },
            startTime: new Date(scheduledEvent.start_time),
            endTime: new Date(scheduledEvent.end_time),
            attendees: {
              createMany: {
                data: getAttendeesWithTimezone(scheduledEvent),
              },
            },
            location: `${scheduledEvent.location.type} @ ${scheduledEvent.location.location}`,
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
          userId: parseInt(userId),
          slug: eventType.slug,
        },
      },
    });
    console.log("addedEvent", addedEvent);
  });

  return res.status(200).json({ message: "Success" });
}
export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
