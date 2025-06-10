// eslint-disable-next-line no-restricted-imports
import { cloneDeep } from "lodash";

import { OrganizerDefaultConferencingAppType, getLocationValueForDB } from "@calcom/app-store/locations";
import { getEventName } from "@calcom/core/event";
import dayjs from "@calcom/dayjs";
import {
  sendRoundRobinCancelledEmailsAndSMS,
  sendRoundRobinScheduledEmailsAndSMS,
  sendRoundRobinUpdatedEmailsAndSMS,
} from "@calcom/emails";
import getBookingResponsesSchema from "@calcom/features/bookings/lib/getBookingResponsesSchema";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import { ensureAvailableUsers } from "@calcom/features/bookings/lib/handleNewBooking/ensureAvailableUsers";
import { getEventTypesFromDB } from "@calcom/features/bookings/lib/handleNewBooking/getEventTypesFromDB";
import type { IsFixedAwareUser } from "@calcom/features/bookings/lib/handleNewBooking/types";
import {
  scheduleEmailReminder,
  deleteScheduledEmailReminder,
} from "@calcom/features/oe/workflows/lib/reminders/emailReminderManager";
import { scheduleWorkflowReminders } from "@calcom/features/oe/workflows/lib/reminders/reminderScheduler";
import { isPrismaObjOrUndefined } from "@calcom/lib";
import { getVideoCallUrlFromCalEvent } from "@calcom/lib/CalEventParser";
import { SENDER_NAME } from "@calcom/lib/constants";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import logger from "@calcom/lib/logger";
import { getLuckyUser } from "@calcom/lib/server";
import { getTranslation } from "@calcom/lib/server/i18n";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import { prisma } from "@calcom/prisma";
import { WorkflowActions, WorkflowMethods, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { userMetadata as userMetadataSchema } from "@calcom/prisma/zod-utils";
import type { EventTypeMetadata, PlatformClientParams } from "@calcom/prisma/zod-utils";
import type { CalendarEvent } from "@calcom/types/Calendar";

import { handleRescheduleEventManager } from "./handleRescheduleEventManager";
import { bookingSelect } from "./utils/bookingSelect";
import { getDestinationCalendar } from "./utils/getDestinationCalendar";
import { getTeamMembers } from "./utils/getTeamMembers";

interface ReassignmentParameters {
  bookingId: number;
  orgId: number | null;
  emailsEnabled?: boolean;
  platformClientParams?: PlatformClientParams;
}

export type ReassignmentResult = {
  bookingId: number;
  reassignedTo: {
    id: number;
    name: string | null;
    email: string;
  };
};

const roundRobinReassignment = async (parameters: ReassignmentParameters): Promise<ReassignmentResult> => {
  const reassignmentLogger = logger.getSubLogger({
    prefix: ["roundRobinReassign", `${parameters.bookingId}`],
  });

  let retrievedBooking = await prisma.booking.findUnique({
    where: {
      id: parameters.bookingId,
    },
    select: bookingSelect,
  });

  if (!retrievedBooking) {
    logger.error(`Booking ${parameters.bookingId} not found`);
    throw new Error("Booking not found");
  }

  if (!retrievedBooking.user) {
    logger.error(`No user associated with booking ${parameters.bookingId}`);
    throw new Error("Booking not found");
  }

  const associatedEventTypeId = retrievedBooking.eventTypeId;

  if (!associatedEventTypeId) {
    logger.error(`Booking ${parameters.bookingId} does not have an event type id`);
    throw new Error("Event type not found");
  }

  const retrievedEventType = await getEventTypesFromDB(associatedEventTypeId);

  if (!retrievedEventType) {
    logger.error(`Event type ${associatedEventTypeId} not found`);
    throw new Error("Event type not found");
  }

  retrievedEventType.hosts = retrievedEventType.hosts.length
    ? retrievedEventType.hosts
    : retrievedEventType.users.map((user) => ({
        user,
        isFixed: false,
        priority: 2,
        weight: 100,
        schedule: null,
        createdAt: new Date(0),
      }));

  const dynamicHostsCollection = retrievedEventType.hosts.filter((host) => !host.isFixed);

  const currentOwner = retrievedBooking.user;

  const participantEmailsCollection = new Set(retrievedBooking.attendees.map((attendee) => attendee.email));

  const identifyCurrentRRHost = () => {
    for (const host of dynamicHostsCollection) {
      if (retrievedBooking && host.user.id === retrievedBooking.userId) {
        return host.user;
      }
      if (participantEmailsCollection.has(host.user.email)) {
        return host.user;
      }
    }
    return undefined;
  };

  const existingRRHost = identifyCurrentRRHost();

  const existingRRHostTranslation = await getTranslation(existingRRHost?.locale || "en", "common");

  const eligibleEventTypeUsers = retrievedEventType.hosts.reduce((availableUsers, host) => {
    if (!participantEmailsCollection.has(host.user.email) && host.user.email !== currentOwner.email) {
      availableUsers.push({ ...host.user, isFixed: host.isFixed, priority: host?.priority ?? 2 });
    }
    return availableUsers;
  }, [] as IsFixedAwareUser[]);

  const confirmedAvailableUsers = await ensureAvailableUsers(
    { ...retrievedEventType, users: eligibleEventTypeUsers },
    {
      dateFrom: dayjs(retrievedBooking.startTime).format(),
      dateTo: dayjs(retrievedBooking.endTime).format(),
      timeZone: retrievedEventType.timeZone || currentOwner.timeZone,
    },
    reassignmentLogger
  );

  const selectedRRHost = await getLuckyUser({
    availableUsers: confirmedAvailableUsers,
    eventType: retrievedEventType,
    allRRHosts: retrievedEventType.hosts.filter((host) => !host.isFixed),
    routingFormResponse: null,
  });

  const ownershipTransition = !existingRRHost || retrievedBooking.userId === existingRRHost?.id;
  const determinedOrganizer = ownershipTransition ? selectedRRHost : retrievedBooking.user;
  const organizerTranslation = await getTranslation(determinedOrganizer?.locale || "en", "common");

  const presentBookingTitle = retrievedBooking.title;
  let modifiedBookingTitle = presentBookingTitle;

  const selectedRRHostTranslation = await getTranslation(selectedRRHost.locale || "en", "common");

  const collaborativeTeamMembers = await getTeamMembers({
    eventTypeHosts: retrievedEventType.hosts,
    attendees: retrievedBooking.attendees,
    organizer: determinedOrganizer,
    previousHost: existingRRHost || null,
    reassignedHost: selectedRRHost,
  });

  const attendeeTranslationTasks = [];
  for (const attendee of retrievedBooking.attendees) {
    if (
      attendee.email === selectedRRHost.email ||
      attendee.email === existingRRHost?.email ||
      collaborativeTeamMembers.some((member) => member.email === attendee.email)
    ) {
      continue;
    }

    attendeeTranslationTasks.push(
      getTranslation(attendee.locale ?? "en", "common").then((tAttendee) => ({
        email: attendee.email,
        name: attendee.name,
        timeZone: attendee.timeZone,
        language: { translate: tAttendee, locale: attendee.locale ?? "en" },
        phoneNumber: attendee.phoneNumber || undefined,
      }))
    );
  }

  const processedAttendeeCollection = await Promise.all(attendeeTranslationTasks);
  let modifiedBookingLocation = retrievedBooking.location;

  if (ownershipTransition) {
    const existingBookingResponses = retrievedBooking.responses;

    const validationSchema = getBookingResponsesSchema({
      bookingFields: retrievedEventType.bookingFields,
      view: "reschedule",
    });

    const validationAttempt = await validationSchema.safeParseAsync(existingBookingResponses);

    const sanitizedResponses = validationAttempt.success ? validationAttempt.data : undefined;

    if (
      retrievedEventType.locations.some((location) => location.type === OrganizerDefaultConferencingAppType)
    ) {
      const organizerMetadataValidation = userMetadataSchema.safeParse(selectedRRHost.metadata);

      const fallbackLocationUrl = organizerMetadataValidation.success
        ? organizerMetadataValidation?.data?.defaultConferencingApp?.appLink
        : undefined;

      const presentBookingLocation = retrievedBooking.location || "integrations:daily";

      modifiedBookingLocation =
        fallbackLocationUrl ||
        getLocationValueForDB(presentBookingLocation, retrievedEventType.locations).bookingLocation;
    }

    const eventIdentificationObject = {
      attendeeName: sanitizedResponses?.name || "Nameless",
      eventType: retrievedEventType.title,
      eventName: retrievedEventType.eventName,
      teamName: collaborativeTeamMembers.length > 1 ? retrievedEventType.team?.name : null,
      host: determinedOrganizer.name || "Nameless",
      location: modifiedBookingLocation || "integrations:daily",
      bookingFields: { ...sanitizedResponses },
      eventDuration: retrievedEventType.length,
      t: organizerTranslation,
    };

    modifiedBookingTitle = getEventName(eventIdentificationObject);

    retrievedBooking = await prisma.booking.update({
      where: {
        id: parameters.bookingId,
      },
      data: {
        userId: selectedRRHost.id,
        title: modifiedBookingTitle,
      },
      select: bookingSelect,
    });
  } else {
    const formerRRHostParticipant = retrievedBooking.attendees.find(
      (attendee) => attendee.email === existingRRHost.email
    );
    await prisma.attendee.update({
      where: {
        id: formerRRHostParticipant!.id,
      },
      data: {
        name: selectedRRHost.name || "",
        email: selectedRRHost.email,
        timeZone: selectedRRHost.timeZone,
        locale: selectedRRHost.locale,
      },
    });
  }

  const targetDestinationCalendar = await getDestinationCalendar({
    eventType: retrievedEventType,
    booking: retrievedBooking,
    newUserId: selectedRRHost.id,
    hasOrganizerChanged: ownershipTransition,
  });

  const formerHostCalendarDestination = ownershipTransition
    ? await prisma.destinationCalendar.findFirst({
        where: {
          userId: currentOwner.id,
        },
      })
    : null;

  const calendarEventConfiguration: CalendarEvent = {
    organizer: {
      name: determinedOrganizer.name || "",
      email: determinedOrganizer.email,
      language: {
        locale: determinedOrganizer.locale || "en",
        translate: organizerTranslation,
      },
      timeZone: determinedOrganizer.timeZone,
      timeFormat: getTimeFormatStringFromUserTimeFormat(determinedOrganizer.timeFormat),
    },
    startTime: dayjs(retrievedBooking.startTime).utc().format(),
    endTime: dayjs(retrievedBooking.endTime).utc().format(),
    type: retrievedEventType.slug,
    title: modifiedBookingTitle,
    description: retrievedEventType.description,
    attendees: processedAttendeeCollection,
    uid: retrievedBooking.uid,
    destinationCalendar: targetDestinationCalendar,
    team: {
      members: collaborativeTeamMembers,
      name: retrievedEventType.team?.name || "",
      id: retrievedEventType.team?.id || 0,
    },
    customInputs: isPrismaObjOrUndefined(retrievedBooking.customInputs),
    ...getCalEventResponses({
      bookingFields: retrievedEventType?.bookingFields ?? null,
      booking: retrievedBooking,
    }),
    location: modifiedBookingLocation,
    ...(parameters.platformClientParams ? parameters.platformClientParams : {}),
  };

  const organizerCredentials = await prisma.credential.findMany({
    where: {
      userId: determinedOrganizer.id,
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  const { evtWithAdditionalInfo } = await handleRescheduleEventManager({
    evt: calendarEventConfiguration,
    rescheduleUid: retrievedBooking.uid,
    newBookingId: undefined,
    changedOrganizer: ownershipTransition,
    previousHostDestinationCalendar: formerHostCalendarDestination ? [formerHostCalendarDestination] : [],
    initParams: {
      user: { ...determinedOrganizer, credentials: [...organizerCredentials] },
    },
    bookingId: parameters.bookingId,
    bookingLocation: modifiedBookingLocation,
    bookingICalUID: retrievedBooking.iCalUID,
    bookingMetadata: retrievedBooking.metadata,
  });

  const { cancellationReason, ...eventWithoutCancellation } = evtWithAdditionalInfo;

  if (parameters.emailsEnabled) {
    await sendRoundRobinScheduledEmailsAndSMS({
      calEvent: eventWithoutCancellation,
      members: [
        {
          ...selectedRRHost,
          name: selectedRRHost.name || "",
          username: selectedRRHost.username || "",
          timeFormat: getTimeFormatStringFromUserTimeFormat(selectedRRHost.timeFormat),
          language: { translate: selectedRRHostTranslation, locale: selectedRRHost.locale || "en" },
        },
      ],
    });
  }

  if (existingRRHost) {
    const cancelledRRHostEventData = cloneDeep(evtWithAdditionalInfo);
    cancelledRRHostEventData.title = presentBookingTitle;
    if (ownershipTransition) {
      cancelledRRHostEventData.organizer = {
        name: existingRRHost.name || "",
        email: existingRRHost.email,
        language: {
          locale: existingRRHost.locale || "en",
          translate: existingRRHostTranslation,
        },
        timeZone: existingRRHost.timeZone,
        timeFormat: getTimeFormatStringFromUserTimeFormat(existingRRHost.timeFormat),
      };
    } else if (cancelledRRHostEventData.team) {
      const updatedMembersArray = cancelledRRHostEventData.team?.members || [];
      cancelledRRHostEventData.team.members = updatedMembersArray.filter(
        (member) => member.email !== selectedRRHost.email
      );
      cancelledRRHostEventData.team.members.unshift({
        id: existingRRHost.id,
        email: existingRRHost.email,
        name: existingRRHost.name || "",
        timeZone: existingRRHost.timeZone,
        language: { translate: existingRRHostTranslation, locale: existingRRHost.locale || "en" },
      });
    }

    if (parameters.emailsEnabled) {
      await sendRoundRobinCancelledEmailsAndSMS(
        cancelledRRHostEventData,
        [
          {
            ...existingRRHost,
            name: existingRRHost.name || "",
            username: existingRRHost.username || "",
            timeFormat: getTimeFormatStringFromUserTimeFormat(existingRRHost.timeFormat),
            language: { translate: existingRRHostTranslation, locale: existingRRHost.locale || "en" },
          },
        ],
        retrievedEventType?.metadata as EventTypeMetadata,
        { name: selectedRRHost.name, email: selectedRRHost.email }
      );
    }
  }

  if (ownershipTransition) {
    if (parameters.emailsEnabled) {
      await sendRoundRobinUpdatedEmailsAndSMS({
        calEvent: eventWithoutCancellation,
      });
    }

    const existingWorkflowReminders = await prisma.workflowReminder.findMany({
      where: {
        bookingUid: retrievedBooking.uid,
        method: WorkflowMethods.EMAIL,
        scheduled: true,
        OR: [{ cancelled: false }, { cancelled: null }],
        workflowStep: {
          workflow: {
            trigger: {
              in: [
                WorkflowTriggerEvents.BEFORE_EVENT,
                WorkflowTriggerEvents.NEW_EVENT,
                WorkflowTriggerEvents.AFTER_EVENT,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        referenceId: true,
        workflowStep: {
          select: {
            id: true,
            template: true,
            workflow: {
              select: {
                trigger: true,
                time: true,
                timeUnit: true,
              },
            },
            emailSubject: true,
            reminderBody: true,
            sender: true,
            includeCalendarEvent: true,
          },
        },
      },
    });

    const workflowMetadataCollection = { videoCallUrl: getVideoCallUrlFromCalEvent(evtWithAdditionalInfo) };

    const applicationBookerUrl = await getBookerBaseUrl(parameters.orgId);

    for (const reminderInstance of existingWorkflowReminders) {
      const stepConfiguration = reminderInstance?.workflowStep;
      const workflowConfiguration = stepConfiguration?.workflow;

      if (stepConfiguration && workflowConfiguration) {
        await scheduleEmailReminder({
          evt: {
            ...evtWithAdditionalInfo,
            metadata: workflowMetadataCollection,
            eventType: retrievedEventType,
            bookerUrl: applicationBookerUrl,
          },
          action: WorkflowActions.EMAIL_HOST,
          triggerEvent: workflowConfiguration.trigger,
          timeSpan: {
            time: workflowConfiguration.time,
            timeUnit: workflowConfiguration.timeUnit,
          },
          sendTo: selectedRRHost.email,
          template: stepConfiguration.template,
          emailSubject: stepConfiguration.emailSubject || undefined,
          emailBody: stepConfiguration.reminderBody || undefined,
          sender: stepConfiguration.sender || SENDER_NAME,
          hideBranding: true,
          includeCalendarEvent: stepConfiguration.includeCalendarEvent,
          workflowStepId: stepConfiguration.id,
        });
      }

      await deleteScheduledEmailReminder(reminderInstance.id, reminderInstance.referenceId);
    }

    const freshEventWorkflows = await prisma.workflow.findMany({
      where: {
        trigger: WorkflowTriggerEvents.NEW_EVENT,
        OR: [
          {
            isActiveOnAll: true,
            teamId: retrievedEventType?.teamId,
          },
          {
            activeOn: {
              some: {
                eventTypeId: associatedEventTypeId,
              },
            },
          },
          ...(retrievedEventType?.teamId
            ? [
                {
                  activeOnTeams: {
                    some: {
                      teamId: retrievedEventType.teamId,
                    },
                  },
                },
              ]
            : []),
          ...(retrievedEventType?.team?.parentId
            ? [
                {
                  isActiveOnAll: true,
                  teamId: retrievedEventType.team.parentId,
                },
              ]
            : []),
        ],
      },
      include: {
        steps: {
          where: {
            action: WorkflowActions.EMAIL_HOST,
          },
        },
      },
    });

    await scheduleWorkflowReminders({
      workflows: freshEventWorkflows,
      smsReminderNumber: null,
      calendarEvent: {
        ...evtWithAdditionalInfo,
        metadata: workflowMetadataCollection,
        eventType: { slug: retrievedEventType.slug },
        bookerUrl: applicationBookerUrl,
      },
      hideBranding: !!retrievedEventType?.owner?.hideBranding,
    });
  }

  return {
    bookingId: parameters.bookingId,
    reassignedTo: {
      id: selectedRRHost.id,
      name: selectedRRHost.name,
      email: selectedRRHost.email,
    },
  };
};

export { roundRobinReassignment };
export default roundRobinReassignment;
