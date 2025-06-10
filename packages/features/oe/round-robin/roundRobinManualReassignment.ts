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
import { getEventTypesFromDB } from "@calcom/features/bookings/lib/handleNewBooking/getEventTypesFromDB";
import AssignmentReasonRecorder from "@calcom/features/oe/round-robin/assignmentReason/AssignmentReasonRecorder";
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
import { getTranslation } from "@calcom/lib/server/i18n";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import { prisma } from "@calcom/prisma";
import { WorkflowActions, WorkflowMethods, WorkflowTriggerEvents } from "@calcom/prisma/enums";
import { userMetadata as userMetadataSchema } from "@calcom/prisma/zod-utils";
import type { EventTypeMetadata, PlatformClientParams } from "@calcom/prisma/zod-utils";
import type { CalendarEvent } from "@calcom/types/Calendar";

import { handleRescheduleEventManager } from "./handleRescheduleEventManager";
import type { BookingSelectResult } from "./utils/bookingSelect";
import { bookingSelect } from "./utils/bookingSelect";
import { getDestinationCalendar } from "./utils/getDestinationCalendar";
import { getTeamMembers } from "./utils/getTeamMembers";

const ReassignmentErrors = {
  HostNotEligible: "invalid_round_robin_host",
  FixedHostRestriction: "user_is_round_robin_fixed",
} as const;

interface ReassignmentConfiguration {
  bookingId: number;
  newUserId: number;
  orgId: number | null;
  reassignReason?: string;
  reassignedById: number;
  emailsEnabled?: boolean;
  platformClientParams?: PlatformClientParams;
}

interface WorkflowProcessingParams {
  booking: BookingSelectResult;
  newUser: {
    id: number;
    email: string;
    locale?: string | null;
  };
  evt: CalendarEvent;
  eventType: Awaited<ReturnType<typeof getEventTypesFromDB>>;
  orgId: number | null;
}

const executeRoundRobinReassignment = async (configuration: ReassignmentConfiguration) => {
  if (configuration.emailsEnabled === undefined) {
    configuration.emailsEnabled = true; // Default to true if not specified
  }
  const reassignmentLogger = logger.getSubLogger({
    prefix: ["roundRobinManualReassign", `${configuration.bookingId}`],
  });

  let retrievedBooking = await prisma.booking.findUnique({
    where: { id: configuration.bookingId },
    select: bookingSelect,
  });

  if (!retrievedBooking || !retrievedBooking.user) {
    reassignmentLogger.error(`Booking ${configuration.bookingId} not found or has no associated user`);
    throw new Error("Booking not found or has no associated user");
  }

  const associatedEventTypeId = retrievedBooking.eventTypeId;
  if (!associatedEventTypeId) {
    reassignmentLogger.error(`Booking ${configuration.bookingId} does not have an event type id`);
    throw new Error("Event type not found");
  }

  const retrievedEventType = await getEventTypesFromDB(associatedEventTypeId);
  if (!retrievedEventType) {
    reassignmentLogger.error(`Event type ${associatedEventTypeId} not found`);
    throw new Error("Event type not found");
  }

  const hostConfiguration = retrievedEventType.hosts.length
    ? retrievedEventType.hosts
    : retrievedEventType.users.map((user) => ({
        user,
        isFixed: false,
        priority: 2,
        weight: 100,
        schedule: null,
        createdAt: new Date(0),
      }));

  const staticHostRole = hostConfiguration.find((host) => host.isFixed);
  const existingRRParticipant = retrievedBooking.attendees.find((attendee) =>
    hostConfiguration.some((host) => !host.isFixed && host.user.email === attendee.email)
  );
  const targetHostRole = hostConfiguration.find((host) => host.user.id === configuration.newUserId);

  if (!targetHostRole) {
    throw new Error(ReassignmentErrors.HostNotEligible);
  }

  if (targetHostRole.isFixed) {
    throw new Error(ReassignmentErrors.FixedHostRestriction);
  }

  const currentBookingOwner = retrievedBooking.user;
  const ownershipWillTransition = !staticHostRole && retrievedBooking.userId !== configuration.newUserId;

  const replacementUser = targetHostRole.user;
  const replacementUserTranslation = await getTranslation(replacementUser.locale || "en", "common");
  const currentOwnerTranslation = await getTranslation(currentBookingOwner.locale || "en", "common");

  const dynamicHostCollection = retrievedEventType.hosts.filter((host) => !host.isFixed);

  const participantEmailCollection = new Set(retrievedBooking.attendees.map((attendee) => attendee.email));

  const identifyFormerRRHost = () => {
    for (const host of dynamicHostCollection) {
      if (retrievedBooking && host.user.id === retrievedBooking.userId) {
        return host.user;
      }
      if (participantEmailCollection.has(host.user.email)) {
        return host.user;
      }
      return undefined;
    }
  };

  const formerRRHost = identifyFormerRRHost();

  const formerRRHostTranslation = await getTranslation(formerRRHost?.locale || "en", "common");
  let modifiedEventLocation = retrievedBooking.location;

  if (ownershipWillTransition) {
    const existingBookingResponses = retrievedBooking.responses;
    const validationSchema = getBookingResponsesSchema({
      bookingFields: retrievedEventType.bookingFields,
      view: "reschedule",
    });
    const validationResult = await validationSchema.safeParseAsync(existingBookingResponses);
    const sanitizedResponses = validationResult.success ? validationResult.data : undefined;

    if (
      retrievedEventType.locations.some((location) => location.type === OrganizerDefaultConferencingAppType)
    ) {
      const replacementUserMetadataValidation = userMetadataSchema.safeParse(replacementUser.metadata);
      const fallbackLocationUrl = replacementUserMetadataValidation.success
        ? replacementUserMetadataValidation?.data?.defaultConferencingApp?.appLink
        : undefined;
      const presentEventLocation = retrievedBooking.location || "integrations:daily";
      modifiedEventLocation =
        fallbackLocationUrl ||
        getLocationValueForDB(presentEventLocation, retrievedEventType.locations).bookingLocation;
    }

    const updatedEventTitle = getEventName({
      attendeeName: sanitizedResponses?.name || "Nameless",
      eventType: retrievedEventType.title,
      eventName: retrievedEventType.eventName,
      teamName: retrievedEventType.team?.name,
      host: replacementUser.name || "Nameless",
      location: modifiedEventLocation || "integrations:daily",
      bookingFields: { ...sanitizedResponses },
      eventDuration: retrievedEventType.length,
      t: replacementUserTranslation,
    });

    retrievedBooking = await prisma.booking.update({
      where: { id: configuration.bookingId },
      data: {
        userId: configuration.newUserId,
        title: updatedEventTitle,
        userPrimaryEmail: replacementUser.email,
        reassignReason: configuration.reassignReason,
        reassignById: configuration.reassignedById,
      },
      select: bookingSelect,
    });

    await AssignmentReasonRecorder.roundRobinReassignment({
      bookingId: configuration.bookingId,
      reassignReason: configuration.reassignReason,
      reassignById: configuration.reassignedById,
    });
  } else if (existingRRParticipant) {
    await prisma.attendee.update({
      where: { id: existingRRParticipant.id },
      data: {
        name: replacementUser.name || "",
        email: replacementUser.email,
        timeZone: replacementUser.timeZone,
        locale: replacementUser.locale,
      },
    });
  }

  const targetCalendarDestination = await getDestinationCalendar({
    eventType: retrievedEventType,
    booking: retrievedBooking,
    newUserId: configuration.newUserId,
    hasOrganizerChanged: ownershipWillTransition,
  });

  const determinedEventOrganizer = ownershipWillTransition
    ? replacementUser
    : retrievedBooking.user ?? replacementUser;

  const organizerTranslation = await getTranslation(determinedEventOrganizer?.locale || "en", "common");

  const collaborativeMembers = await getTeamMembers({
    eventTypeHosts: hostConfiguration,
    attendees: retrievedBooking.attendees,
    organizer: determinedEventOrganizer,
    previousHost: formerRRHost || null,
    reassignedHost: replacementUser,
  });

  const attendeeTranslationTasks = [];
  for (const attendee of retrievedBooking.attendees) {
    if (
      attendee.email === replacementUser.email ||
      attendee.email === formerRRHost?.email ||
      collaborativeMembers.some((member) => member.email === attendee.email)
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

  const processedAttendeeList = await Promise.all(attendeeTranslationTasks);

  const eventConfiguration: CalendarEvent = {
    type: retrievedEventType.slug,
    title: retrievedBooking.title,
    description: retrievedEventType.description,
    startTime: dayjs(retrievedBooking.startTime).utc().format(),
    endTime: dayjs(retrievedBooking.endTime).utc().format(),
    organizer: {
      email: determinedEventOrganizer.email,
      name: determinedEventOrganizer.name || "",
      timeZone: determinedEventOrganizer.timeZone,
      language: { translate: organizerTranslation, locale: determinedEventOrganizer.locale || "en" },
    },
    attendees: processedAttendeeList,
    uid: retrievedBooking.uid,
    destinationCalendar: targetCalendarDestination,
    team: {
      members: collaborativeMembers,
      name: retrievedEventType.team?.name || "",
      id: retrievedEventType.team?.id || 0,
    },
    customInputs: isPrismaObjOrUndefined(retrievedBooking.customInputs),
    ...getCalEventResponses({
      bookingFields: retrievedEventType.bookingFields ?? null,
      booking: retrievedBooking,
    }),
    location: modifiedEventLocation,
    ...(configuration.platformClientParams ? configuration.platformClientParams : {}),
    hideBranding: retrievedEventType.owner?.hideBranding ?? retrievedEventType.team?.hideBranding ?? false,
    bannerUrl: retrievedEventType.owner?.bannerUrl ?? retrievedEventType.team?.bannerUrl ?? null,
  };

  const userCredentials = await prisma.credential.findMany({
    where: { userId: replacementUser.id },
    include: { user: { select: { email: true } } },
  });

  const formerHostCalendarDestination = ownershipWillTransition
    ? await prisma.destinationCalendar.findFirst({
        where: { userId: currentBookingOwner.id },
      })
    : null;

  const { evtWithAdditionalInfo } = await handleRescheduleEventManager({
    evt: eventConfiguration,
    rescheduleUid: retrievedBooking.uid,
    newBookingId: undefined,
    changedOrganizer: ownershipWillTransition,
    previousHostDestinationCalendar: formerHostCalendarDestination ? [formerHostCalendarDestination] : [],
    initParams: {
      user: { ...replacementUser, credentials: userCredentials },
    },
    bookingId: configuration.bookingId,
    bookingLocation: modifiedEventLocation,
    bookingICalUID: retrievedBooking.iCalUID,
    bookingMetadata: retrievedBooking.metadata,
  });

  const { cancellationReason, ...eventDataWithoutCancellation } = evtWithAdditionalInfo;

  if (configuration.emailsEnabled) {
    await sendRoundRobinScheduledEmailsAndSMS({
      calEvent: eventDataWithoutCancellation,
      members: [
        {
          ...replacementUser,
          name: replacementUser.name || "",
          username: replacementUser.username || "",
          timeFormat: getTimeFormatStringFromUserTimeFormat(replacementUser.timeFormat),
          language: { translate: replacementUserTranslation, locale: replacementUser.locale || "en" },
        },
      ],
      reassigned: {
        name: replacementUser.name,
        email: replacementUser.email,
        reason: configuration.reassignReason,
        byUser: currentBookingOwner.name || undefined,
      },
    });
  }

  const cancelledEventData = cloneDeep(evtWithAdditionalInfo);
  cancelledEventData.organizer = {
    email: currentBookingOwner.email,
    name: currentBookingOwner.name || "",
    timeZone: currentBookingOwner.timeZone,
    language: { translate: currentOwnerTranslation, locale: currentBookingOwner.locale || "en" },
  };

  if (formerRRHost && configuration.emailsEnabled) {
    await sendRoundRobinCancelledEmailsAndSMS(
      cancelledEventData,
      [
        {
          ...formerRRHost,
          name: formerRRHost.name || "",
          username: formerRRHost.username || "",
          timeFormat: getTimeFormatStringFromUserTimeFormat(formerRRHost.timeFormat),
          language: { translate: formerRRHostTranslation, locale: formerRRHost.locale || "en" },
        },
      ],
      retrievedEventType?.metadata as EventTypeMetadata,
      { name: replacementUser.name, email: replacementUser.email }
    );
  }

  if (ownershipWillTransition) {
    if (configuration.emailsEnabled) {
      await sendRoundRobinUpdatedEmailsAndSMS({
        calEvent: eventDataWithoutCancellation,
      });
    }

    await processWorkflowModifications({
      booking: retrievedBooking,
      newUser: replacementUser,
      evt: evtWithAdditionalInfo,
      eventType: retrievedEventType,
      orgId: configuration.orgId,
    });
  }

  return retrievedBooking;
};

const processWorkflowModifications = async (parameters: WorkflowProcessingParams) => {
  const existingWorkflowReminders = await prisma.workflowReminder.findMany({
    where: {
      bookingUid: parameters.booking.uid,
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

  const eventMetadataForWorkflow = { videoCallUrl: getVideoCallUrlFromCalEvent(parameters.evt) };
  const applicationBookerUrl = await getBookerBaseUrl(parameters.orgId);

  for (const reminderInstance of existingWorkflowReminders) {
    const stepConfiguration = reminderInstance.workflowStep;

    if (stepConfiguration) {
      const workflowSettings = stepConfiguration.workflow;
      await scheduleEmailReminder({
        evt: {
          ...parameters.evt,
          metadata: eventMetadataForWorkflow,
          eventType: parameters.eventType,
          bookerUrl: applicationBookerUrl,
        },
        action: WorkflowActions.EMAIL_HOST,
        triggerEvent: workflowSettings.trigger,
        timeSpan: {
          time: workflowSettings.time,
          timeUnit: workflowSettings.timeUnit,
        },
        sendTo: parameters.newUser.email,
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
          teamId: parameters.eventType?.teamId,
        },
        {
          activeOn: {
            some: {
              eventTypeId: parameters.eventType.id,
            },
          },
        },
        ...(parameters.eventType?.teamId
          ? [
              {
                activeOnTeams: {
                  some: {
                    teamId: parameters.eventType.teamId,
                  },
                },
              },
            ]
          : []),
        ...(parameters.eventType?.team?.parentId
          ? [
              {
                isActiveOnAll: true,
                teamId: parameters.eventType.team.parentId,
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
      ...parameters.evt,
      metadata: eventMetadataForWorkflow,
      eventType: { slug: parameters.eventType.slug },
      bookerUrl: applicationBookerUrl,
    },
    hideBranding: !!parameters.eventType?.owner?.hideBranding,
  });
};

export { executeRoundRobinReassignment as roundRobinManualReassignment };
export default executeRoundRobinReassignment;
