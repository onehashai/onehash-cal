import type { DestinationCalendar } from "@prisma/client";
import type { Prisma } from "@prisma/client";
// eslint-disable-next-line no-restricted-imports
import { cloneDeep } from "lodash";
import type { NextApiRequest } from "next";
import short, { uuid } from "short-uuid";
import { v5 as uuidv5 } from "uuid";
import type z from "zod";

import processExternalId from "@calcom/app-store/_utils/calendars/processExternalId";
import { metadata as GoogleMeetMetadata } from "@calcom/app-store/googlevideo/_metadata";
import {
  JitsiLocationType,
  MeetLocationType,
  OrganizerDefaultConferencingAppType,
  getLocationValueForDB,
} from "@calcom/app-store/locations";
import { getAppFromSlug } from "@calcom/app-store/utils";
import EventManager from "@calcom/core/EventManager";
import { getEventName } from "@calcom/core/event";
import dayjs from "@calcom/dayjs";
import {
  sendAttendeeRequestEmailAndSMS,
  sendOrganizerRequestEmail,
  sendRescheduledEmailsAndSMS,
  sendRoundRobinCancelledEmailsAndSMS,
  sendRoundRobinRescheduledEmailsAndSMS,
  sendRoundRobinScheduledEmailsAndSMS,
  sendScheduledEmailsAndSMS,
} from "@calcom/emails";
import getICalUID from "@calcom/emails/lib/getICalUID";
import { getBookingFieldsWithSystemFields } from "@calcom/features/bookings/lib/getBookingFields";
import { handleWebhookTrigger } from "@calcom/features/bookings/lib/handleWebhookTrigger";
import { isEventTypeLoggingEnabled } from "@calcom/features/bookings/lib/isEventTypeLoggingEnabled";
import { getFullName } from "@calcom/features/form-builder/utils";
import {
  allowDisablingAttendeeConfirmationEmails,
  allowDisablingHostConfirmationEmails,
} from "@calcom/features/oe/workflows/lib/allowDisablingStandardEmails";
import { scheduleWorkflowReminders } from "@calcom/features/oe/workflows/lib/reminders/reminderScheduler";
import { scheduleMandatoryReminder } from "@calcom/features/oe/workflows/lib/reminders/scheduleMandatoryReminder";
import type { GetSubscriberOptions } from "@calcom/features/webhooks/lib/getWebhooks";
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import {
  deleteWebhookScheduledTriggers,
  scheduleTrigger,
} from "@calcom/features/webhooks/lib/scheduleTrigger";
import { isPrismaObj, isPrismaObjOrUndefined } from "@calcom/lib";
import { getVideoCallUrlFromCalEvent } from "@calcom/lib/CalEventParser";
import { ONEHASH_API_KEY, ONEHASH_CHAT_SYNC_BASE_URL } from "@calcom/lib/constants";
import { getUTCOffsetByTimezone } from "@calcom/lib/date-fns";
import { getDefaultEvent, getUsernameList } from "@calcom/lib/defaultEvents";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { getErrorFromUnknown } from "@calcom/lib/errors";
import { extractBaseEmail } from "@calcom/lib/extract-base-email";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import getOrgIdFromMemberOrTeamId from "@calcom/lib/getOrgIdFromMemberOrTeamId";
import getPaymentAppData from "@calcom/lib/getPaymentAppData";
import { getTeamIdFromEventType } from "@calcom/lib/getTeamIdFromEventType";
import { HttpError } from "@calcom/lib/http-error";
import isOutOfBounds, { BookingDateInPastError } from "@calcom/lib/isOutOfBounds";
import logger from "@calcom/lib/logger";
import { handlePayment } from "@calcom/lib/payment/handlePayment";
import { getPiiFreeCalendarEvent, getPiiFreeEventType, getPiiFreeUser } from "@calcom/lib/piiFreeData";
import { safeStringify } from "@calcom/lib/safeStringify";
import { checkBookingLimits, checkDurationLimits, getLuckyUser } from "@calcom/lib/server";
import { getTranslation } from "@calcom/lib/server/i18n";
import { WorkflowRepository } from "@calcom/lib/server/repository/workflow";
import { slugify } from "@calcom/lib/slugify";
import { updateWebUser as syncServicesUpdateWebUser } from "@calcom/lib/sync/SyncServiceManager";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma, { userSelect } from "@calcom/prisma";
import type { BookingReference } from "@calcom/prisma/client";
import { BookingStatus, SchedulingType, WebhookTriggerEvents } from "@calcom/prisma/enums";
import { credentialForCalendarServiceSelect } from "@calcom/prisma/selects/credential";
import type { bookingCreateSchemaLegacyPropsForApi } from "@calcom/prisma/zod-utils";
import { userMetadata as userMetadataSchema } from "@calcom/prisma/zod-utils";
import { getAllWorkflowsFromEventType } from "@calcom/trpc/server/routers/viewer/workflows/util";
import type {
  AdditionalInformation,
  AppsStatus,
  CalendarEvent,
  IntervalLimit,
  Person,
} from "@calcom/types/Calendar";
import type { EventResult, PartialReference } from "@calcom/types/EventManager";

import type { EventPayloadType, EventTypeInfo } from "../../webhooks/lib/sendPayload";
import { getAllCredentials } from "./getAllCredentialsForUsersOnEvent/getAllCredentials";
import { refreshCredentials } from "./getAllCredentialsForUsersOnEvent/refreshCredentials";
import getBookingDataSchema from "./getBookingDataSchema";
import { checkIfBookerEmailIsBlocked } from "./handleNewBooking/checkIfBookerEmailIsBlocked";
import { createBooking } from "./handleNewBooking/createBooking";
import { ensureAvailableUsers } from "./handleNewBooking/ensureAvailableUsers";
import { getBookingData } from "./handleNewBooking/getBookingData";
import { getEventTypesFromDB } from "./handleNewBooking/getEventTypesFromDB";
import type { getEventTypeResponse } from "./handleNewBooking/getEventTypesFromDB";
import { getOriginalRescheduledBooking } from "./handleNewBooking/getOriginalRescheduledBooking";
import { getRequiresConfirmationFlags } from "./handleNewBooking/getRequiresConfirmationFlags";
import { handleAppsStatus } from "./handleNewBooking/handleAppsStatus";
import { loadUsers } from "./handleNewBooking/loadUsers";
import type {
  Invitee,
  IEventTypePaymentCredentialType,
  IsFixedAwareUser,
  BookingType,
  Booking,
} from "./handleNewBooking/types";
import handleSeats from "./handleSeats/handleSeats";
import type { BookingSeat } from "./handleSeats/types";

const translator = short();
const log = logger.getSubLogger({ prefix: ["[api] book:user"] });

export function getCustomInputsResponses(
  reqBody: {
    responses?: Record<string, object>;
    customInputs?: z.infer<typeof bookingCreateSchemaLegacyPropsForApi>["customInputs"];
  },
  eventTypeCustomInputs: getEventTypeResponse["customInputs"]
) {
  const customInputsResponses = {} as NonNullable<CalendarEvent["customInputs"]>;
  if (reqBody.customInputs && (reqBody.customInputs.length || 0) > 0) {
    reqBody.customInputs.forEach(({ label, value }) => {
      customInputsResponses[label] = value;
    });
  } else {
    const responses = reqBody.responses || {};
    // Backward Compatibility: Map new `responses` to old `customInputs` format so that webhooks can still receive same values.
    for (const [fieldName, fieldValue] of Object.entries(responses)) {
      const foundACustomInputForTheResponse = eventTypeCustomInputs.find(
        (input) => slugify(input.label) === fieldName
      );
      if (foundACustomInputForTheResponse) {
        customInputsResponses[foundACustomInputForTheResponse.label] = fieldValue;
      }
    }
  }

  return customInputsResponses;
}

/** Updates the evt object with video call data found from booking references
 *
 * @param bookingReferences
 * @param evt
 *
 * @returns updated evt with video call data
 */
export const addVideoCallDataToEvent = (bookingReferences: BookingReference[], evt: CalendarEvent) => {
  const videoCallReference = bookingReferences.find((reference) => reference.type.includes("_video"));

  if (videoCallReference) {
    evt.videoCallData = {
      type: videoCallReference.type,
      id: videoCallReference.meetingId,
      password: videoCallReference?.meetingPassword,
      url: videoCallReference.meetingUrl,
    };
  }

  return evt;
};

export const createLoggerWithEventDetails = (
  eventTypeId: number,
  reqBodyUser: string | string[] | undefined,
  eventTypeSlug: string | undefined
) => {
  return logger.getSubLogger({
    prefix: ["book:user", `${eventTypeId}:${reqBodyUser}/${eventTypeSlug}`],
  });
};

function getICalSequence(originalRescheduledBooking: BookingType | null) {
  // If new booking set the sequence to 0
  if (!originalRescheduledBooking) {
    return 0;
  }

  // If rescheduling and there is no sequence set, assume sequence should be 1
  if (!originalRescheduledBooking.iCalSequence) {
    return 1;
  }

  // If rescheduling then increment sequence by 1
  return originalRescheduledBooking.iCalSequence + 1;
}

type BookingDataSchemaGetter =
  | typeof getBookingDataSchema
  | typeof import("@calcom/features/bookings/lib/getBookingDataSchemaForApi").default;

async function handler(
  req: NextApiRequest & {
    userId?: number | undefined;
    platformClientId?: string;
    platformRescheduleUrl?: string;
    platformCancelUrl?: string;
    platformBookingUrl?: string;
    platformBookingLocation?: string;
  },
  bookingDataSchemaGetter: BookingDataSchemaGetter = getBookingDataSchema
) {
  const {
    userId,
    platformClientId,
    platformCancelUrl,
    platformBookingUrl,
    platformRescheduleUrl,
    platformBookingLocation,
  } = req;

  // handle dynamic user
  let eventType =
    !req.body.eventTypeId && !!req.body.eventTypeSlug
      ? getDefaultEvent(req.body.eventTypeSlug)
      : await getEventTypesFromDB(req.body.eventTypeId);

  const isOrgTeamEvent = !!eventType?.team && !!eventType?.team?.parentId;

  eventType = {
    ...eventType,
    bookingFields: getBookingFieldsWithSystemFields({ ...eventType, isOrgTeamEvent }),
  };

  const bookingDataSchema = bookingDataSchemaGetter({
    view: req.body?.rescheduleUid ? "reschedule" : "booking",
    bookingFields: eventType.bookingFields,
  });
  const bookingData = await getBookingData({
    req,
    eventType,
    schema: bookingDataSchema,
  });

  const {
    recurringCount,
    noEmail,
    eventTypeId,
    eventTypeSlug,
    hasHashedBookingLink,
    language,
    appsStatus: reqAppsStatus,
    name: bookerName,
    attendeePhoneNumber: bookerPhoneNumber,
    email: bookerEmail,
    guests: reqGuests,
    location,
    notes: additionalNotes,
    smsReminderNumber,
    rescheduleReason,
    luckyUsers,
    ...reqBody
  } = bookingData;

  const loggerWithEventDetails = createLoggerWithEventDetails(eventTypeId, reqBody.user, eventTypeSlug);

  await checkIfBookerEmailIsBlocked({ loggedInUserId: userId, bookerEmail });

  if (isEventTypeLoggingEnabled({ eventTypeId, usernameOrTeamName: reqBody.user })) {
    logger.settings.minLevel = 0;
  }

  const fullName = getFullName(bookerName);
  // Why are we only using "en" locale
  const tGuests = await getTranslation("en", "common");

  const dynamicUserList = Array.isArray(reqBody.user) ? reqBody.user : getUsernameList(reqBody.user);
  if (!eventType) throw new HttpError({ statusCode: 404, message: "event_type_not_found" });

  const isTeamEventType =
    !!eventType.schedulingType && ["COLLECTIVE", "ROUND_ROBIN"].includes(eventType.schedulingType);

  const paymentAppData = getPaymentAppData(eventType);
  loggerWithEventDetails.info(
    `Booking eventType ${eventTypeId} started`,
    safeStringify({
      reqBody: {
        user: reqBody.user,
        eventTypeId,
        eventTypeSlug,
        startTime: reqBody.start,
        endTime: reqBody.end,
        rescheduleUid: reqBody.rescheduleUid,
        location: location,
        timeZone: reqBody.timeZone,
      },
      isTeamEventType,
      eventType: getPiiFreeEventType(eventType),
      dynamicUserList,
      paymentAppData: {
        enabled: paymentAppData.enabled,
        price: paymentAppData.price,
        paymentOption: paymentAppData.paymentOption,
        currency: paymentAppData.currency,
        appId: paymentAppData.appId,
      },
    })
  );

  const user = eventType.users.find((user) => user.id === eventType.userId);

  const userSchedule = user?.schedules.find((schedule) => schedule.id === user?.defaultScheduleId);

  const eventTimeZone = eventType.schedule?.timeZone ?? userSchedule?.timeZone;

  let timeOutOfBounds = false;
  try {
    timeOutOfBounds = isOutOfBounds(
      reqBody.start,
      {
        periodType: eventType.periodType,
        periodDays: eventType.periodDays,
        periodEndDate: eventType.periodEndDate,
        periodStartDate: eventType.periodStartDate,
        periodCountCalendarDays: eventType.periodCountCalendarDays,
        bookerUtcOffset: getUTCOffsetByTimezone(reqBody.timeZone) ?? 0,
        eventUtcOffset: eventTimeZone ? getUTCOffsetByTimezone(eventTimeZone) ?? 0 : 0,
      },
      eventType.minimumBookingNotice
    );
  } catch (error) {
    loggerWithEventDetails.warn({
      message: "NewBooking: Unable set timeOutOfBounds. Using false. ",
    });
    if (error instanceof BookingDateInPastError) {
      // TODO: HttpError should not bleed through to the console.
      loggerWithEventDetails.info(`Booking eventType ${eventTypeId} failed`, JSON.stringify({ error }));
      throw new HttpError({ statusCode: 400, message: error.message });
    }
  }

  if (timeOutOfBounds) {
    const error = {
      errorCode: "BookingTimeOutOfBounds",
      message: `EventType '${eventType.eventName}' cannot be booked at this time.`,
    };
    loggerWithEventDetails.warn({
      message: `NewBooking: EventType '${eventType.eventName}' cannot be booked at this time.`,
    });
    throw new HttpError({ statusCode: 400, message: error.message });
  }

  const reqEventLength = dayjs(reqBody.end).diff(dayjs(reqBody.start), "minutes");
  const validEventLengths = eventType.metadata?.multipleDuration?.length
    ? eventType.metadata.multipleDuration
    : [eventType.length];
  if (!validEventLengths.includes(reqEventLength)) {
    loggerWithEventDetails.warn({ message: "NewBooking: Invalid event length" });
    throw new HttpError({ statusCode: 400, message: "Invalid event length" });
  }

  // loadUsers allows type inferring
  let users: (Awaited<ReturnType<typeof loadUsers>>[number] & {
    isFixed?: boolean;
    metadata?: Prisma.JsonValue;
  })[] = await loadUsers(eventType, dynamicUserList, req);

  const isDynamicAllowed = !users.some((user) => !user.allowDynamicBooking);
  if (!isDynamicAllowed && !eventTypeId) {
    loggerWithEventDetails.warn({
      message: "NewBooking: Some of the users in this group do not allow dynamic booking",
    });
    throw new HttpError({
      message: "Some of the users in this group do not allow dynamic booking",
      statusCode: 400,
    });
  }

  // If this event was pre-relationship migration
  // TODO: Establish whether this is dead code.
  if (!users.length && eventType.userId) {
    const eventTypeUser = await prisma.user.findUnique({
      where: {
        id: eventType.userId,
      },
      select: {
        credentials: {
          select: credentialForCalendarServiceSelect,
        }, // Don't leak to client
        ...userSelect.select,
      },
    });
    if (!eventTypeUser) {
      loggerWithEventDetails.warn({ message: "NewBooking: eventTypeUser.notFound" });
      throw new HttpError({ statusCode: 404, message: "eventTypeUser.notFound" });
    }
    users.push(eventTypeUser);
  }

  if (!users) throw new HttpError({ statusCode: 404, message: "eventTypeUser.notFound" });

  users = users.map((user) => ({
    ...user,
    isFixed:
      user.isFixed === false
        ? false
        : user.isFixed || eventType.schedulingType !== SchedulingType.ROUND_ROBIN,
  }));

  loggerWithEventDetails.debug(
    "Concerned users",
    safeStringify({
      users: users.map(getPiiFreeUser),
    })
  );

  let locationBodyString = location;

  // TODO: It's definition should be moved to getLocationValueForDb
  let organizerOrFirstDynamicGroupMemberDefaultLocationUrl = undefined;

  if (dynamicUserList.length > 1) {
    users = users.sort((a, b) => {
      const aIndex = (a.username && dynamicUserList.indexOf(a.username)) || 0;
      const bIndex = (b.username && dynamicUserList.indexOf(b.username)) || 0;
      return aIndex - bIndex;
    });
    const firstUsersMetadata = userMetadataSchema.parse(users[0].metadata);
    locationBodyString = firstUsersMetadata?.defaultConferencingApp?.appLink || locationBodyString;
    organizerOrFirstDynamicGroupMemberDefaultLocationUrl =
      firstUsersMetadata?.defaultConferencingApp?.appLink;
  }

  let rescheduleUid = reqBody.rescheduleUid;

  if (
    Object.prototype.hasOwnProperty.call(eventType, "bookingLimits") ||
    Object.prototype.hasOwnProperty.call(eventType, "durationLimits")
  ) {
    const startAsDate = dayjs(reqBody.start).toDate();
    if (
      eventType.bookingLimits &&
      /* Empty object is truthy */ Object.keys(eventType.bookingLimits).length > 0
    ) {
      await checkBookingLimits(
        eventType.bookingLimits as IntervalLimit,
        startAsDate,
        eventType.id,
        rescheduleUid,
        eventTimeZone
      );
    }
    if (eventType.durationLimits) {
      await checkDurationLimits(
        eventType.durationLimits as IntervalLimit,
        startAsDate,
        eventType.id,
        rescheduleUid
      );
    }
  }

  let bookingSeat: BookingSeat = null;

  let originalRescheduledBooking: BookingType = null;

  //this gets the original rescheduled booking
  if (rescheduleUid) {
    // rescheduleUid can be bookingUid and bookingSeatUid
    bookingSeat = await prisma.bookingSeat.findUnique({
      where: {
        referenceUid: rescheduleUid,
      },
      include: {
        booking: true,
        attendee: true,
      },
    });
    if (bookingSeat) {
      rescheduleUid = bookingSeat.booking.uid;
    }
    originalRescheduledBooking = await getOriginalRescheduledBooking(
      rescheduleUid,
      !!eventType.seatsPerTimeSlot
    );
    if (!originalRescheduledBooking) {
      throw new HttpError({ statusCode: 404, message: "Could not find original booking" });
    }

    if (
      originalRescheduledBooking.status === BookingStatus.CANCELLED &&
      !originalRescheduledBooking.rescheduled
    ) {
      throw new HttpError({ statusCode: 403, message: ErrorCode.CancelledBookingsCannotBeRescheduled });
    }
  }

  let luckyUserResponse;
  let isFirstSeat = true;

  if (eventType.seatsPerTimeSlot) {
    const booking = await prisma.booking.findFirst({
      where: {
        eventTypeId: eventType.id,
        startTime: new Date(dayjs(reqBody.start).utc().format()),
        status: BookingStatus.ACCEPTED,
      },
    });

    if (booking) isFirstSeat = false;
  }

  //checks what users are available
  if (isFirstSeat) {
    const eventTypeWithUsers: getEventTypeResponse & {
      users: IsFixedAwareUser[];
    } = {
      ...eventType,
      users: users as IsFixedAwareUser[],
      ...(eventType.recurringEvent && {
        recurringEvent: {
          ...eventType.recurringEvent,
          count: recurringCount || eventType.recurringEvent.count,
        },
      }),
    };
    if (req.body.allRecurringDates && req.body.isFirstRecurringSlot) {
      const isTeamEvent =
        eventType.schedulingType === SchedulingType.COLLECTIVE ||
        eventType.schedulingType === SchedulingType.ROUND_ROBIN;

      const fixedUsers = isTeamEvent
        ? eventTypeWithUsers.users.filter((user: IsFixedAwareUser) => user.isFixed)
        : [];

      for (
        let i = 0;
        i < req.body.allRecurringDates.length && i < req.body.numSlotsToCheckForAvailability;
        i++
      ) {
        const start = req.body.allRecurringDates[i].start;
        const end = req.body.allRecurringDates[i].end;
        if (isTeamEvent) {
          // each fixed user must be available
          for (const key in fixedUsers) {
            await ensureAvailableUsers(
              { ...eventTypeWithUsers, users: [fixedUsers[key]] },
              {
                dateFrom: dayjs(start).tz(reqBody.timeZone).format(),
                dateTo: dayjs(end).tz(reqBody.timeZone).format(),
                timeZone: reqBody.timeZone,
                originalRescheduledBooking,
              },
              loggerWithEventDetails
            );
          }
        } else {
          await ensureAvailableUsers(
            eventTypeWithUsers,
            {
              dateFrom: dayjs(start).tz(reqBody.timeZone).format(),
              dateTo: dayjs(end).tz(reqBody.timeZone).format(),
              timeZone: reqBody.timeZone,
              originalRescheduledBooking,
            },
            loggerWithEventDetails
          );
        }
      }
    }

    if (!req.body.allRecurringDates || req.body.isFirstRecurringSlot) {
      const availableUsers = await ensureAvailableUsers(
        eventTypeWithUsers,
        {
          dateFrom: dayjs(reqBody.start).tz(reqBody.timeZone).format(),
          dateTo: dayjs(reqBody.end).tz(reqBody.timeZone).format(),
          timeZone: reqBody.timeZone,
          originalRescheduledBooking,
        },
        loggerWithEventDetails
      );
      const luckyUsers: typeof users = [];
      const luckyUserPool: IsFixedAwareUser[] = [];
      const fixedUserPool: IsFixedAwareUser[] = [];
      availableUsers.forEach((user) => {
        user.isFixed ? fixedUserPool.push(user) : luckyUserPool.push(user);
      });

      const notAvailableLuckyUsers: typeof users = [];

      loggerWithEventDetails.debug(
        "Computed available users",
        safeStringify({
          availableUsers: availableUsers.map((user) => user.id),
          luckyUserPool: luckyUserPool.map((user) => user.id),
        })
      );

      if (reqBody.teamMemberEmail) {
        // If requested user is not a fixed host, assign the lucky user as the team member
        if (!fixedUserPool.some((user) => user.email === reqBody.teamMemberEmail)) {
          const teamMember = availableUsers.find((user) => user.email === reqBody.teamMemberEmail);
          if (teamMember) {
            luckyUsers.push(teamMember);
          }
        }
      }

      // loop through all non-fixed hosts and get the lucky users
      while (luckyUserPool.length > 0 && luckyUsers.length < 1 /* TODO: Add variable */) {
        const freeUsers = luckyUserPool.filter(
          (user) => !luckyUsers.concat(notAvailableLuckyUsers).find((existing) => existing.id === user.id)
        );
        const originalRescheduledBookingUserId =
          originalRescheduledBooking && originalRescheduledBooking.userId;
        const isSameRoundRobinHost =
          !!originalRescheduledBookingUserId &&
          eventType.schedulingType === SchedulingType.ROUND_ROBIN &&
          eventType.rescheduleWithSameRoundRobinHost;

        const newLuckyUser = isSameRoundRobinHost
          ? freeUsers.find((user) => user.id === originalRescheduledBookingUserId)
          : await getLuckyUser("MAXIMIZE_AVAILABILITY", {
              // find a lucky user that is not already in the luckyUsers array
              availableUsers: freeUsers,
              allRRHosts: eventTypeWithUsers.hosts.filter((host) => !host.isFixed),
              eventType,
            });
        if (!newLuckyUser) {
          break; // prevent infinite loop
        }
        if (req.body.isFirstRecurringSlot && eventType.schedulingType === SchedulingType.ROUND_ROBIN) {
          // for recurring round robin events check if lucky user is available for next slots
          try {
            for (
              let i = 0;
              i < req.body.allRecurringDates.length && i < req.body.numSlotsToCheckForAvailability;
              i++
            ) {
              const start = req.body.allRecurringDates[i].start;
              const end = req.body.allRecurringDates[i].end;

              await ensureAvailableUsers(
                { ...eventTypeWithUsers, users: [newLuckyUser] },
                {
                  dateFrom: dayjs(start).tz(reqBody.timeZone).format(),
                  dateTo: dayjs(end).tz(reqBody.timeZone).format(),
                  timeZone: reqBody.timeZone,
                  originalRescheduledBooking,
                },
                loggerWithEventDetails
              );
            }
            // if no error, then lucky user is available for the next slots
            luckyUsers.push(newLuckyUser);
          } catch {
            notAvailableLuckyUsers.push(newLuckyUser);
            loggerWithEventDetails.info(
              `Round robin host ${newLuckyUser.name} not available for first two slots. Trying to find another host.`
            );
          }
        } else {
          luckyUsers.push(newLuckyUser);
        }
      }
      // ALL fixed users must be available
      if (fixedUserPool.length !== users.filter((user) => user.isFixed).length) {
        throw new Error(ErrorCode.HostsUnavailableForBooking);
      }
      // Pushing fixed user before the luckyUser guarantees the (first) fixed user as the organizer.
      users = [...fixedUserPool, ...luckyUsers];
      luckyUserResponse = { luckyUsers: luckyUsers.map((u) => u.id) };
    } else if (req.body.allRecurringDates && eventType.schedulingType === SchedulingType.ROUND_ROBIN) {
      // all recurring slots except the first one
      const luckyUsersFromFirstBooking = luckyUsers
        ? eventTypeWithUsers.users.filter((user) => luckyUsers.find((luckyUserId) => luckyUserId === user.id))
        : [];
      const fixedHosts = eventTypeWithUsers.users.filter((user: IsFixedAwareUser) => user.isFixed);
      users = [...fixedHosts, ...luckyUsersFromFirstBooking];
    }
  }

  if (users.length === 0 && eventType.schedulingType === SchedulingType.ROUND_ROBIN) {
    loggerWithEventDetails.error(`No available users found for round robin event.`);
    throw new Error(ErrorCode.NoAvailableUsersFound);
  }

  // If the team member is requested then they should be the organizer
  const organizerUser = reqBody.teamMemberEmail
    ? users.find((user) => user.email === reqBody.teamMemberEmail) ?? users[0]
    : users[0];

  const tOrganizer = await getTranslation(organizerUser?.locale ?? "en", "common");
  const allCredentials = await getAllCredentials(organizerUser, eventType);

  const { userReschedulingIsOwner, isConfirmedByDefault } = getRequiresConfirmationFlags({
    eventType,
    bookingStartTime: reqBody.start,
    userId,
    originalRescheduledBookingOrganizerId: originalRescheduledBooking?.user?.id,
    paymentAppData,
  });

  // If the Organizer himself is rescheduling, the booker should be sent the communication in his timezone and locale.
  const attendeeInfoOnReschedule =
    userReschedulingIsOwner && originalRescheduledBooking
      ? originalRescheduledBooking.attendees.find((attendee) => attendee.email === bookerEmail)
      : null;

  const attendeeLanguage = attendeeInfoOnReschedule ? attendeeInfoOnReschedule.locale : language;
  const attendeeTimezone = attendeeInfoOnReschedule ? attendeeInfoOnReschedule.timeZone : reqBody.timeZone;

  const tAttendees = await getTranslation(attendeeLanguage ?? "en", "common");

  const isManagedEventType = !!eventType.parentId;

  // If location passed is empty , use default location of event
  // If location of event is not set , use host default
  if (locationBodyString.trim().length == 0) {
    if (eventType.locations.length > 0) {
      locationBodyString = eventType.locations[0].type;
    } else {
      locationBodyString = OrganizerDefaultConferencingAppType;
    }
  }
  // use host default
  if (locationBodyString == OrganizerDefaultConferencingAppType) {
    const metadataParseResult = userMetadataSchema.safeParse(organizerUser.metadata);
    const organizerMetadata = metadataParseResult.success ? metadataParseResult.data : undefined;
    if (organizerMetadata?.defaultConferencingApp?.appSlug) {
      const app = getAppFromSlug(organizerMetadata?.defaultConferencingApp?.appSlug);
      locationBodyString = app?.appData?.location?.type || locationBodyString;
      if (isManagedEventType || isTeamEventType) {
        organizerOrFirstDynamicGroupMemberDefaultLocationUrl =
          organizerMetadata?.defaultConferencingApp?.appLink;
      }
    } else {
      //CHANGE:JITSI
      // locationBodyString = "integrations:daily";
      locationBodyString = JitsiLocationType;
    }
  }

  const invitee: Invitee = [
    {
      email: bookerEmail,
      name: fullName,
      phoneNumber: bookerPhoneNumber,
      firstName: (typeof bookerName === "object" && bookerName.firstName) || "",
      lastName: (typeof bookerName === "object" && bookerName.lastName) || "",
      timeZone: attendeeTimezone,
      language: { translate: tAttendees, locale: attendeeLanguage ?? "en" },
    },
  ];

  const blacklistedGuestEmails = process.env.BLACKLISTED_GUEST_EMAILS
    ? process.env.BLACKLISTED_GUEST_EMAILS.split(",")
    : [];

  const guestsRemoved: string[] = [];
  const guests = (reqGuests || []).reduce((guestArray, guest) => {
    const baseGuestEmail = extractBaseEmail(guest).toLowerCase();
    if (blacklistedGuestEmails.some((e) => e.toLowerCase() === baseGuestEmail)) {
      guestsRemoved.push(guest);
      return guestArray;
    }
    // If it's a team event, remove the team member from guests
    if (isTeamEventType && users.some((user) => user.email === guest)) {
      return guestArray;
    }
    guestArray.push({
      email: guest,
      name: "",
      firstName: "",
      lastName: "",
      timeZone: attendeeTimezone,
      language: { translate: tGuests, locale: "en" },
    });
    return guestArray;
  }, [] as Invitee);

  if (guestsRemoved.length > 0) {
    log.info("Removed guests from the booking", guestsRemoved);
  }

  const seed = `${organizerUser.username}:${dayjs(reqBody.start).utc().format()}:${new Date().getTime()}`;
  const uid = translator.fromUUID(uuidv5(seed, uuidv5.URL));

  // For static link based video apps, it would have the static URL value instead of it's type(e.g. integrations:campfire_video)
  // This ensures that createMeeting isn't called for static video apps as bookingLocation becomes just a regular value for them.
  const { bookingLocation, conferenceCredentialId } = organizerOrFirstDynamicGroupMemberDefaultLocationUrl
    ? {
        bookingLocation: organizerOrFirstDynamicGroupMemberDefaultLocationUrl,
        conferenceCredentialId: undefined,
      }
    : getLocationValueForDB(locationBodyString, eventType.locations);

  const customInputs = getCustomInputsResponses(reqBody, eventType.customInputs);
  const teamDestinationCalendars: DestinationCalendar[] = [];

  // Organizer or user owner of this event type it's not listed as a team member.
  const teamMemberPromises = users
    .filter((user) => user.email !== organizerUser.email)
    .map(async (user) => {
      // TODO: Add back once EventManager tests are ready https://github.com/calcom/cal.com/pull/14610#discussion_r1567817120
      // push to teamDestinationCalendars if it's a team event but collective only
      if (isTeamEventType && eventType.schedulingType === "COLLECTIVE" && user.destinationCalendar) {
        teamDestinationCalendars.push({
          ...user.destinationCalendar,
          externalId: processExternalId(user.destinationCalendar),
        });
      }

      return {
        id: user.id,
        email: user.email ?? "",
        name: user.name ?? "",
        firstName: "",
        lastName: "",
        timeZone: user.timeZone,
        language: {
          translate: await getTranslation(user.locale ?? "en", "common"),
          locale: user.locale ?? "en",
        },
      };
    });
  const teamMembers = await Promise.all(teamMemberPromises);

  const attendeesList = [...invitee, ...guests];

  const responses = reqBody.responses || null;

  const evtName = !eventType?.isDynamic ? eventType.eventName : responses?.title;
  const eventNameObject = {
    //TODO: Can we have an unnamed attendee? If not, I would really like to throw an error here.
    attendeeName: fullName || "Nameless",
    eventType: eventType.title,
    eventName: evtName,
    // we send on behalf of team if >1 round robin attendee | collective
    teamName: eventType.schedulingType === "COLLECTIVE" || users.length > 1 ? eventType.team?.name : null,
    // TODO: Can we have an unnamed organizer? If not, I would really like to throw an error here.
    host: organizerUser.name || "Nameless",
    location: bookingLocation,
    eventDuration: eventType.length,
    bookingFields: { ...responses },
    t: tOrganizer,
  };

  const iCalUID = getICalUID({
    event: { iCalUID: originalRescheduledBooking?.iCalUID, uid: originalRescheduledBooking?.uid },
    uid,
  });
  // For bookings made before introducing iCalSequence, assume that the sequence should start at 1. For new bookings start at 0.
  const iCalSequence = getICalSequence(originalRescheduledBooking);
  const organizerOrganizationProfile = await prisma.profile.findFirst({
    where: {
      userId: organizerUser.id,
      username: dynamicUserList[0],
    },
  });

  const organizerOrganizationId = organizerOrganizationProfile?.organizationId;
  const bookerUrl = eventType.team
    ? await getBookerBaseUrl(eventType.team.parentId)
    : await getBookerBaseUrl(organizerOrganizationId ?? null);

  const destinationCalendar = eventType.destinationCalendar
    ? [eventType.destinationCalendar]
    : organizerUser.destinationCalendar
    ? [organizerUser.destinationCalendar]
    : null;

  let organizerEmail = organizerUser.email || "Email-less";
  if (eventType.useEventTypeDestinationCalendarEmail && destinationCalendar?.[0]?.primaryEmail) {
    organizerEmail = destinationCalendar[0].primaryEmail;
  } else if (eventType.secondaryEmailId && eventType.secondaryEmail?.email) {
    organizerEmail = eventType.secondaryEmail.email;
  }

  //udpate cal event responses with latest location value , later used by webhook
  if (reqBody.calEventResponses)
    reqBody.calEventResponses["location"].value = {
      value: platformBookingLocation ?? bookingLocation,
      optionValue: "",
    };
  let evt: CalendarEvent = {
    bookerUrl,
    type: eventType.slug,
    title: getEventName(eventNameObject), //this needs to be either forced in english, or fetched for each attendee and organizer separately
    description: eventType.description,
    additionalNotes,
    customInputs,
    startTime: dayjs(reqBody.start).utc().format(),
    endTime: dayjs(reqBody.end).utc().format(),
    organizer: {
      id: organizerUser.id,
      name: organizerUser.name || "Nameless",
      email: organizerEmail,
      username: organizerUser.username || undefined,
      timeZone: organizerUser.timeZone,
      language: { translate: tOrganizer, locale: organizerUser.locale ?? "en" },
      timeFormat: getTimeFormatStringFromUserTimeFormat(organizerUser.timeFormat),
      phoneNumber:
        isPrismaObj(organizerUser.metadata) && organizerUser.metadata?.phoneNumber
          ? (organizerUser.metadata?.phoneNumber as string)
          : undefined,
    },
    responses: reqBody.calEventResponses || null,
    userFieldsResponses: reqBody.calEventUserFieldsResponses || null,
    attendees: attendeesList,
    location: platformBookingLocation ?? bookingLocation, // Will be processed by the EventManager later.
    conferenceCredentialId,
    destinationCalendar,
    hideCalendarNotes: eventType.hideCalendarNotes,
    hideCalendarEventDetails: eventType.hideCalendarEventDetails,
    requiresConfirmation: !isConfirmedByDefault,
    eventTypeId: eventType.id,
    // if seats are not enabled we should default true
    seatsShowAttendees: eventType.seatsPerTimeSlot ? eventType.seatsShowAttendees : true,
    seatsPerTimeSlot: eventType.seatsPerTimeSlot,
    seatsShowAvailabilityCount: eventType.seatsPerTimeSlot ? eventType.seatsShowAvailabilityCount : true,
    schedulingType: eventType.schedulingType,
    iCalUID,
    iCalSequence,
    platformClientId,
    platformRescheduleUrl,
    platformCancelUrl,
    platformBookingUrl,
    oneTimePassword: isConfirmedByDefault ? null : undefined,
  };

  if (req.body.thirdPartyRecurringEventId) {
    evt.existingRecurringEvent = {
      recurringEventId: req.body.thirdPartyRecurringEventId,
    };
  }

  if (isTeamEventType && eventType.schedulingType === "COLLECTIVE") {
    evt.destinationCalendar?.push(...teamDestinationCalendars);
  }

  // data needed for triggering webhooks
  const eventTypeInfo: EventTypeInfo = {
    eventTitle: eventType.title,
    eventDescription: eventType.description,
    price: paymentAppData.price,
    currency: eventType.currency,
    length: reqEventLength,
  };

  const teamId = await getTeamIdFromEventType({ eventType });

  const triggerForUser = !teamId || (teamId && eventType.parentId);

  const organizerUserId = triggerForUser ? organizerUser.id : null;

  const orgId = await getOrgIdFromMemberOrTeamId({ memberId: organizerUserId, teamId });

  const subscriberOptions: GetSubscriberOptions = {
    userId: organizerUserId,
    eventTypeId,
    triggerEvent: WebhookTriggerEvents.BOOKING_CREATED,
    teamId,
    orgId,
    oAuthClientId: platformClientId,
  };

  const eventTrigger: WebhookTriggerEvents = rescheduleUid
    ? WebhookTriggerEvents.BOOKING_RESCHEDULED
    : WebhookTriggerEvents.BOOKING_CREATED;

  subscriberOptions.triggerEvent = eventTrigger;

  const subscriberOptionsMeetingEnded = {
    userId: triggerForUser ? organizerUser.id : null,
    eventTypeId,
    triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
    teamId,
    orgId,
  };

  const subscriberOptionsMeetingStarted = {
    userId: triggerForUser ? organizerUser.id : null,
    eventTypeId,
    triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
    teamId,
    orgId,
  };

  const workflows = await getAllWorkflowsFromEventType(eventType, organizerUser.id);

  if (isTeamEventType) {
    evt.team = {
      members: teamMembers,
      name: eventType.team?.name || "Nameless",
      id: eventType.team?.id ?? 0,
    };
  }

  // For seats, if the booking already exists then we want to add the new attendee to the existing booking
  if (eventType.seatsPerTimeSlot) {
    const newSeat = await handleSeats({
      rescheduleUid,
      reqBookingUid: reqBody.bookingUid,
      eventType,
      evt: { ...evt, bookerUrl },
      invitee,
      allCredentials,
      organizerUser,
      originalRescheduledBooking,
      bookerEmail,
      bookerPhoneNumber,
      tAttendees,
      bookingSeat,
      reqUserId: req.userId,
      rescheduleReason,
      reqBodyUser: reqBody.user,
      noEmail,
      isConfirmedByDefault,
      additionalNotes,
      reqAppsStatus,
      attendeeLanguage,
      paymentAppData,
      fullName,
      smsReminderNumber,
      eventTypeInfo,
      uid,
      eventTypeId,
      reqBodyMetadata: reqBody.metadata,
      subscriberOptions,
      eventTrigger,
      responses,
      workflows,
      rescheduledBy: reqBody.rescheduledBy,
    });

    if (newSeat) {
      req.statusCode = 201;
      const bookingResponse = {
        ...newSeat,
        user: {
          ...newSeat.user,
          email: null,
        },
        paymentRequired: false,
      };
      return {
        ...bookingResponse,
        ...luckyUserResponse,
      };
    } else {
      // Rescheduling logic for the original seated event was handled in handleSeats
      // We want to use new booking logic for the new time slot
      originalRescheduledBooking = null;
      evt.iCalUID = getICalUID({
        attendeeId: bookingSeat?.attendeeId,
      });
    }
  }

  if (reqBody.recurringEventId && eventType.recurringEvent) {
    // Overriding the recurring event configuration count to be the actual number of events booked for
    // the recurring event (equal or less than recurring event configuration count)
    eventType.recurringEvent = Object.assign({}, eventType.recurringEvent, { count: recurringCount });
    evt.recurringEvent = eventType.recurringEvent;
  }

  const changedOrganizer =
    !!originalRescheduledBooking &&
    eventType.schedulingType === SchedulingType.ROUND_ROBIN &&
    originalRescheduledBooking.userId !== evt.organizer.id;

  let results: EventResult<AdditionalInformation & { url?: string; iCalUID?: string }>[] = [];
  let referencesToCreate: PartialReference[] = [];

  let booking: (Booking & { appsStatus?: AppsStatus[]; paymentUid?: string; paymentId?: number }) | null =
    null;

  loggerWithEventDetails.debug(
    "Going to create booking in DB now",
    safeStringify({
      organizerUser: organizerUser.id,
      attendeesList: attendeesList.map((guest) => ({ timeZone: guest.timeZone })),
      requiresConfirmation: evt.requiresConfirmation,
      isConfirmedByDefault,
      userReschedulingIsOwner,
    })
  );

  // update original rescheduled booking (no seats event)
  if (!eventType.seatsPerTimeSlot && originalRescheduledBooking?.uid) {
    await prisma.booking.update({
      where: {
        id: originalRescheduledBooking.id,
      },
      data: {
        rescheduled: true,
        status: BookingStatus.CANCELLED,
        rescheduledBy: reqBody.rescheduledBy,
      },
    });
  }

  try {
    booking = await createBooking({
      originalRescheduledBooking,
      evt,
      eventTypeId,
      eventTypeSlug,
      reqBodyUser: reqBody.user,
      reqBodyMetadata: reqBody.metadata,
      reqBodyRecurringEventId: reqBody.recurringEventId,
      uid,
      responses,
      isConfirmedByDefault,
      smsReminderNumber,
      organizerUser,
      rescheduleReason,
      eventType,
      bookerEmail,
      paymentAppData,
      changedOrganizer,
    });

    // @NOTE: Add specific try catch for all subsequent async calls to avoid error
    // Sync Services
    await syncServicesUpdateWebUser(
      await prisma.user.findFirst({
        where: { id: userId },
        select: { id: true, email: true, name: true, username: true, createdDate: true },
      })
    );
    evt.uid = booking?.uid ?? null;
    evt.oneTimePassword = booking?.oneTimePassword ?? null;

    //adding attendee ID to   evtWithMetadata.attendees
    const attendeeMap = booking.attendees.reduce(
      (
        mapObj: {
          [key: string]: number;
        },
        attendee
      ) => {
        mapObj[attendee.email] = attendee.id;
        return mapObj;
      },
      {}
    );
    evt.attendees.forEach((attendee: { id?: number; email: string; name: string }) => {
      attendee.id = attendeeMap[attendee.email];
    });

    if (booking && booking.id && eventType.seatsPerTimeSlot) {
      const currentAttendee = booking.attendees.find(
        (attendee) =>
          attendee.email === req.body.responses.email ||
          (req.body.responses.attendeePhoneNumber &&
            attendee.phoneNumber === req.body.responses.attendeePhoneNumber)
      );

      // Save description to bookingSeat
      const uniqueAttendeeId = uuid();
      await prisma.bookingSeat.create({
        data: {
          referenceUid: uniqueAttendeeId,
          data: {
            description: additionalNotes,
            responses,
          },
          booking: {
            connect: {
              id: booking.id,
            },
          },
          attendee: {
            connect: {
              id: currentAttendee?.id,
            },
          },
        },
      });
      evt.attendeeSeatId = uniqueAttendeeId;
    }
  } catch (_err) {
    const err = getErrorFromUnknown(_err);
    loggerWithEventDetails.error(
      `Booking ${eventTypeId} failed`,
      "Error when saving booking to db",
      err.message
    );
    if (err.code === "P2002") {
      throw new HttpError({ statusCode: 409, message: "booking_conflict" });
    }
    throw err;
  }

  // After polling videoBusyTimes, credentials might have been changed due to refreshment, so query them again.
  const credentials = await refreshCredentials(allCredentials);
  const eventManager = new EventManager({ ...organizerUser, credentials }, eventType?.metadata?.apps);

  let videoCallUrl;

  //this is the actual rescheduling logic
  if (!eventType.seatsPerTimeSlot && originalRescheduledBooking?.uid) {
    log.silly("Rescheduling booking", originalRescheduledBooking.uid);
    // cancel workflow reminders from previous rescheduled booking
    await WorkflowRepository.deleteAllWorkflowReminders(originalRescheduledBooking.workflowReminders);

    evt = addVideoCallDataToEvent(originalRescheduledBooking.references, evt);

    // If organizer is changed in RR event then we need to delete the previous host destination calendar events
    const previousHostDestinationCalendar = originalRescheduledBooking?.destinationCalendar
      ? [originalRescheduledBooking?.destinationCalendar]
      : [];

    if (changedOrganizer) {
      evt.title = getEventName(eventNameObject);
      // location might changed and will be new created in eventManager.create (organizer default location)
      evt.videoCallData = undefined;
      // To prevent "The requested identifier already exists" error while updating event, we need to remove iCalUID
      evt.iCalUID = undefined;
    } else {
      // In case of rescheduling, we need to keep the previous host destination calendar
      evt.destinationCalendar = originalRescheduledBooking?.destinationCalendar
        ? [originalRescheduledBooking?.destinationCalendar]
        : evt.destinationCalendar;
    }

    const updateManager = await eventManager.reschedule(
      evt,
      originalRescheduledBooking.uid,
      undefined,
      changedOrganizer,
      previousHostDestinationCalendar
    );
    // This gets overridden when updating the event - to check if notes have been hidden or not. We just reset this back
    // to the default description when we are sending the emails.
    evt.description = eventType.description;

    results = updateManager.results;
    referencesToCreate = updateManager.referencesToCreate;

    videoCallUrl = evt.videoCallData && evt.videoCallData.url ? evt.videoCallData.url : null;

    // This gets overridden when creating the event - to check if notes have been hidden or not. We just reset this back
    // to the default description when we are sending the emails.
    evt.description = eventType.description;

    const { metadata: videoMetadata, videoCallUrl: _videoCallUrl } = getVideoCallDetails({
      results,
    });

    let metadata: AdditionalInformation = {};
    metadata = videoMetadata;
    videoCallUrl = _videoCallUrl;

    const isThereAnIntegrationError = results && results.some((res) => !res.success);

    if (isThereAnIntegrationError) {
      const error = {
        errorCode: "BookingReschedulingMeetingFailed",
        message: "Booking Rescheduling failed",
      };

      loggerWithEventDetails.error(
        `EventManager.reschedule failure in some of the integrations ${organizerUser.username}`,
        safeStringify({ error, results })
      );
    } else {
      if (results.length) {
        // Handle Google Meet results
        // We use the original booking location since the evt location changes to daily
        if (bookingLocation === MeetLocationType) {
          const googleMeetResult = {
            appName: GoogleMeetMetadata.name,
            type: "conferencing",
            uid: results[0].uid,
            originalEvent: results[0].originalEvent,
          };

          // Find index of google_calendar inside createManager.referencesToCreate
          const googleCalIndex = updateManager.referencesToCreate.findIndex(
            (ref) => ref.type === "google_calendar"
          );
          const googleCalResult = results[googleCalIndex];

          if (!googleCalResult) {
            loggerWithEventDetails.warn("Google Calendar not installed but using Google Meet as location");
            results.push({
              ...googleMeetResult,
              success: false,
              calWarnings: [tOrganizer("google_meet_warning")],
            });
          }

          const googleHangoutLink = Array.isArray(googleCalResult?.updatedEvent)
            ? googleCalResult.updatedEvent[0]?.hangoutLink
            : googleCalResult?.updatedEvent?.hangoutLink ?? googleCalResult?.createdEvent?.hangoutLink;

          if (googleHangoutLink) {
            results.push({
              ...googleMeetResult,
              success: true,
            });

            // Add google_meet to referencesToCreate in the same index as google_calendar
            updateManager.referencesToCreate[googleCalIndex] = {
              ...updateManager.referencesToCreate[googleCalIndex],
              meetingUrl: googleHangoutLink,
            };

            // Also create a new referenceToCreate with type video for google_meet
            updateManager.referencesToCreate.push({
              type: "google_meet_video",
              meetingUrl: googleHangoutLink,
              uid: googleCalResult.uid,
              credentialId: updateManager.referencesToCreate[googleCalIndex].credentialId,
            });
          } else if (googleCalResult && !googleHangoutLink) {
            results.push({
              ...googleMeetResult,
              success: false,
            });
          }
        }
        const createdOrUpdatedEvent = Array.isArray(results[0]?.updatedEvent)
          ? results[0]?.updatedEvent[0]
          : results[0]?.updatedEvent ?? results[0]?.createdEvent;
        metadata.hangoutLink = createdOrUpdatedEvent?.hangoutLink;
        metadata.conferenceData = createdOrUpdatedEvent?.conferenceData;
        metadata.entryPoints = createdOrUpdatedEvent?.entryPoints;
        evt.appsStatus = handleAppsStatus(results, booking, reqAppsStatus);
        videoCallUrl =
          metadata.hangoutLink ||
          createdOrUpdatedEvent?.url ||
          organizerOrFirstDynamicGroupMemberDefaultLocationUrl ||
          getVideoCallUrlFromCalEvent(evt) ||
          videoCallUrl;
      }

      const calendarResult = results.find((result) => result.type.includes("_calendar"));

      evt.iCalUID = Array.isArray(calendarResult?.updatedEvent)
        ? calendarResult?.updatedEvent[0]?.iCalUID
        : calendarResult?.updatedEvent?.iCalUID || undefined;
    }

    evt.appsStatus = handleAppsStatus(results, booking, reqAppsStatus);

    if (noEmail !== true && isConfirmedByDefault) {
      const copyEvent = cloneDeep(evt);
      const copyEventAdditionalInfo = {
        ...copyEvent,
        additionalInformation: metadata,
        additionalNotes, // Resets back to the additionalNote input and not the override value
        cancellationReason: `$RCH$${rescheduleReason ? rescheduleReason : ""}`, // Removable code prefix to differentiate cancellation from rescheduling for email
      };
      loggerWithEventDetails.debug("Emails: Sending rescheduled emails for booking confirmation");

      /*
        handle emails for round robin
          - if booked rr host is the same, then rescheduling email
          - if new rr host is booked, then cancellation email to old host and confirmation email to new host
      */
      if (eventType.schedulingType === SchedulingType.ROUND_ROBIN) {
        const originalBookingMemberEmails: Person[] = [];

        for (const user of originalRescheduledBooking.attendees) {
          const translate = await getTranslation(user.locale ?? "en", "common");
          originalBookingMemberEmails.push({
            name: user.name,
            email: user.email,
            timeZone: user.timeZone,
            phoneNumber: user.phoneNumber,
            language: { translate, locale: user.locale ?? "en" },
          });
        }
        if (originalRescheduledBooking.user) {
          const translate = await getTranslation(originalRescheduledBooking.user.locale ?? "en", "common");
          originalBookingMemberEmails.push({
            ...originalRescheduledBooking.user,
            name: originalRescheduledBooking.user.name || "",
            language: { translate, locale: originalRescheduledBooking.user.locale ?? "en" },
          });
        }

        const newBookingMemberEmails: Person[] =
          copyEvent.team?.members
            .map((member) => member)
            .concat(copyEvent.organizer)
            .concat(copyEvent.attendees) || [];

        const matchOriginalMemberWithNewMember = (originalMember: Person, newMember: Person) => {
          return originalMember.email === newMember.email;
        };

        // scheduled Emails
        const newBookedMembers = newBookingMemberEmails.filter(
          (member) =>
            !originalBookingMemberEmails.find((originalMember) =>
              matchOriginalMemberWithNewMember(originalMember, member)
            )
        );
        // cancelled Emails
        const cancelledMembers = originalBookingMemberEmails.filter(
          (member) =>
            !newBookingMemberEmails.find((newMember) => matchOriginalMemberWithNewMember(member, newMember))
        );
        // rescheduled Emails
        const rescheduledMembers = newBookingMemberEmails.filter((member) =>
          originalBookingMemberEmails.find((orignalMember) =>
            matchOriginalMemberWithNewMember(orignalMember, member)
          )
        );

        sendRoundRobinRescheduledEmailsAndSMS(
          copyEventAdditionalInfo,
          rescheduledMembers,
          eventType.metadata
        );
        sendRoundRobinScheduledEmailsAndSMS(copyEventAdditionalInfo, newBookedMembers, eventType.metadata);
        sendRoundRobinCancelledEmailsAndSMS(copyEventAdditionalInfo, cancelledMembers, eventType.metadata);
      } else {
        // send normal rescheduled emails (non round robin event, where organizers stay the same)
        await sendRescheduledEmailsAndSMS(
          {
            ...copyEvent,
            additionalInformation: metadata,
            additionalNotes, // Resets back to the additionalNote input and not the override value
            cancellationReason: `$RCH$${rescheduleReason ? rescheduleReason : ""}`, // Removable code prefix to differentiate cancellation from rescheduling for email
          },
          eventType?.metadata
        );
      }
    }
    // If it's not a reschedule, doesn't require confirmation and there's no price,
    // Create a booking
  } else if (isConfirmedByDefault) {
    // Use EventManager to conditionally use all needed integrations.
    const createManager = await eventManager.create(evt);

    if (evt.location) {
      booking.location = evt.location;
    }

    // This gets overridden when creating the event - to check if notes have been hidden or not. We just reset this back
    // to the default description when we are sending the emails.
    evt.description = eventType.description;

    results = createManager.results;
    referencesToCreate = createManager.referencesToCreate;
    videoCallUrl = evt.videoCallData && evt.videoCallData.url ? evt.videoCallData.url : null;

    if (results.length > 0 && results.every((res) => !res.success)) {
      const error = {
        errorCode: "BookingCreatingMeetingFailed",
        message: "Booking failed",
      };

      loggerWithEventDetails.error(
        `EventManager.create failure in some of the integrations ${organizerUser.username}`,
        safeStringify({ error, results })
      );
    } else {
      const additionalInformation: AdditionalInformation = {};

      if (results.length) {
        // Handle Google Meet results
        // We use the original booking location since the evt location changes to daily
        if (bookingLocation === MeetLocationType) {
          const googleMeetResult = {
            appName: GoogleMeetMetadata.name,
            type: "conferencing",
            uid: results[0].uid,
            originalEvent: results[0].originalEvent,
          };

          // Find index of google_calendar inside createManager.referencesToCreate
          const googleCalIndex = createManager.referencesToCreate.findIndex(
            (ref) => ref.type === "google_calendar"
          );
          const googleCalResult = results[googleCalIndex];

          if (!googleCalResult) {
            loggerWithEventDetails.warn("Google Calendar not installed but using Google Meet as location");
            results.push({
              ...googleMeetResult,
              success: false,
              calWarnings: [tOrganizer("google_meet_warning")],
            });
          }

          if (googleCalResult?.createdEvent?.hangoutLink) {
            results.push({
              ...googleMeetResult,
              success: true,
            });

            // Add google_meet to referencesToCreate in the same index as google_calendar
            createManager.referencesToCreate[googleCalIndex] = {
              ...createManager.referencesToCreate[googleCalIndex],
              meetingUrl: googleCalResult.createdEvent.hangoutLink,
            };

            // Also create a new referenceToCreate with type video for google_meet
            createManager.referencesToCreate.push({
              type: "google_meet_video",
              meetingUrl: googleCalResult.createdEvent.hangoutLink,
              uid: googleCalResult.uid,
              credentialId: createManager.referencesToCreate[googleCalIndex].credentialId,
            });
          } else if (googleCalResult && !googleCalResult.createdEvent?.hangoutLink) {
            results.push({
              ...googleMeetResult,
              success: false,
            });
          }
        }
        // TODO: Handle created event metadata more elegantly
        additionalInformation.hangoutLink = results[0].createdEvent?.hangoutLink;
        additionalInformation.conferenceData = results[0].createdEvent?.conferenceData;
        additionalInformation.entryPoints = results[0].createdEvent?.entryPoints;
        evt.appsStatus = handleAppsStatus(results, booking, reqAppsStatus);
        videoCallUrl =
          additionalInformation.hangoutLink ||
          organizerOrFirstDynamicGroupMemberDefaultLocationUrl ||
          videoCallUrl;

        if (evt.iCalUID !== booking.iCalUID) {
          // The eventManager could change the iCalUID. At this point we can update the DB record
          await prisma.booking.update({
            where: {
              id: booking.id,
            },
            data: {
              iCalUID: evt.iCalUID || booking.iCalUID,
            },
          });
        }
      }
      if (noEmail !== true) {
        let isHostConfirmationEmailsDisabled = false;
        let isAttendeeConfirmationEmailDisabled = false;

        isHostConfirmationEmailsDisabled =
          eventType.metadata?.disableStandardEmails?.confirmation?.host || false;
        isAttendeeConfirmationEmailDisabled =
          eventType.metadata?.disableStandardEmails?.confirmation?.attendee || false;

        if (isHostConfirmationEmailsDisabled) {
          isHostConfirmationEmailsDisabled = allowDisablingHostConfirmationEmails(workflows);
        }

        if (isAttendeeConfirmationEmailDisabled) {
          isAttendeeConfirmationEmailDisabled = allowDisablingAttendeeConfirmationEmails(workflows);
        }

        loggerWithEventDetails.debug(
          "Emails: Sending scheduled emails for booking confirmation",
          safeStringify({
            calEvent: getPiiFreeCalendarEvent(evt),
          })
        );

        await sendScheduledEmailsAndSMS(
          {
            ...evt,
            additionalInformation,
            additionalNotes,
            customInputs,
          },
          eventNameObject,
          isHostConfirmationEmailsDisabled,
          isAttendeeConfirmationEmailDisabled,
          eventType.metadata
        );
      }
    }
  } else {
    // If isConfirmedByDefault is false, then booking can't be considered ACCEPTED and thus EventManager has no role to play. Booking is created as PENDING
    loggerWithEventDetails.debug(
      `EventManager doesn't need to create or reschedule event for booking ${organizerUser.username}`,
      safeStringify({
        calEvent: getPiiFreeCalendarEvent(evt),
        isConfirmedByDefault,
        paymentValue: paymentAppData.price,
      })
    );
  }

  const bookingRequiresPayment =
    !Number.isNaN(paymentAppData.price) &&
    paymentAppData.price > 0 &&
    !originalRescheduledBooking?.paid &&
    !!booking;

  if (!isConfirmedByDefault && noEmail !== true && !bookingRequiresPayment) {
    loggerWithEventDetails.debug(
      `Emails: Booking ${organizerUser.username} requires confirmation, sending request emails`,
      safeStringify({
        calEvent: getPiiFreeCalendarEvent(evt),
      })
    );
    await sendOrganizerRequestEmail({ ...evt, additionalNotes }, eventType.metadata);
    await sendAttendeeRequestEmailAndSMS({ ...evt, additionalNotes }, attendeesList[0], eventType.metadata);
  }

  if (booking.location?.startsWith("http")) {
    videoCallUrl = booking.location;
  }

  const metadata = videoCallUrl
    ? {
        videoCallUrl: getVideoCallUrlFromCalEvent(evt) || videoCallUrl,
      }
    : undefined;

  const webhookData: EventPayloadType = {
    ...evt,
    ...eventTypeInfo,
    bookingId: booking?.id,
    rescheduleId: originalRescheduledBooking?.id || undefined,
    rescheduleUid,
    rescheduleStartTime: originalRescheduledBooking?.startTime
      ? dayjs(originalRescheduledBooking?.startTime).utc().format()
      : undefined,
    rescheduleEndTime: originalRescheduledBooking?.endTime
      ? dayjs(originalRescheduledBooking?.endTime).utc().format()
      : undefined,
    metadata: { ...metadata, ...reqBody.metadata },
    eventTypeId,
    status: "ACCEPTED",
    smsReminderNumber: booking?.smsReminderNumber || undefined,
    rescheduledBy: reqBody.rescheduledBy,
    cancellationReason: "N/A",
  };

  if (bookingRequiresPayment) {
    loggerWithEventDetails.debug(`Booking ${organizerUser.username} requires payment`);
    // Load credentials.app.categories
    const credentialPaymentAppCategories = await prisma.credential.findMany({
      where: {
        ...(paymentAppData.credentialId ? { id: paymentAppData.credentialId } : { userId: organizerUser.id }),
        app: {
          categories: {
            hasSome: ["payment"],
          },
        },
      },
      select: {
        key: true,
        appId: true,
        app: {
          select: {
            categories: true,
            dirName: true,
          },
        },
      },
    });
    const eventTypePaymentAppCredential = credentialPaymentAppCategories.find((credential) => {
      return credential.appId === paymentAppData.appId;
    });

    if (!eventTypePaymentAppCredential) {
      throw new HttpError({ statusCode: 400, message: "Missing payment credentials" });
    }

    // Convert type of eventTypePaymentAppCredential to appId: EventTypeAppList
    if (!booking.user) booking.user = organizerUser;
    const payment = await handlePayment(
      evt,
      eventType,
      eventTypePaymentAppCredential as IEventTypePaymentCredentialType,
      booking,
      fullName,
      bookerEmail,
      bookerPhoneNumber
    );
    const subscriberOptionsPaymentInitiated: GetSubscriberOptions = {
      userId: triggerForUser ? organizerUser.id : null,
      eventTypeId,
      triggerEvent: WebhookTriggerEvents.BOOKING_PAYMENT_INITIATED,
      teamId,
      orgId,
      oAuthClientId: platformClientId,
    };
    await handleWebhookTrigger({
      subscriberOptions: subscriberOptionsPaymentInitiated,
      eventTrigger: WebhookTriggerEvents.BOOKING_PAYMENT_INITIATED,
      webhookData: {
        ...webhookData,
        paymentId: payment?.id,
      },
    });

    req.statusCode = 201;

    // TODO: Refactor better so this booking object is not passed
    // all around and instead the individual fields are sent as args.
    const bookingResponse = {
      ...booking,
      user: {
        ...booking.user,
        email: null,
      },
    };

    return {
      ...bookingResponse,
      ...luckyUserResponse,
      message: "Payment required",
      paymentRequired: true,
      paymentUid: payment?.uid,
      paymentId: payment?.id,
      paymentLink: (isPrismaObjOrUndefined(payment?.data)?.paymentLink as string) || undefined,
    };
  }

  loggerWithEventDetails.debug(`Booking ${organizerUser.username} completed`);

  // We are here so, booking doesn't require payment and booking is also created in DB already, through createBooking call
  if (isConfirmedByDefault) {
    const subscribersMeetingEnded = await getWebhooks(subscriberOptionsMeetingEnded);
    const subscribersMeetingStarted = await getWebhooks(subscriberOptionsMeetingStarted);

    let deleteWebhookScheduledTriggerPromise: Promise<unknown> = Promise.resolve();
    const scheduleTriggerPromises = [];

    if (rescheduleUid && originalRescheduledBooking) {
      //delete all scheduled triggers for meeting ended and meeting started of booking
      deleteWebhookScheduledTriggerPromise = deleteWebhookScheduledTriggers({
        booking: originalRescheduledBooking,
      });
    }

    if (booking && booking.status === BookingStatus.ACCEPTED) {
      for (const subscriber of subscribersMeetingEnded) {
        scheduleTriggerPromises.push(
          scheduleTrigger({
            booking,
            subscriberUrl: subscriber.subscriberUrl,
            subscriber,
            triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
          })
        );
      }

      for (const subscriber of subscribersMeetingStarted) {
        scheduleTriggerPromises.push(
          scheduleTrigger({
            booking,
            subscriberUrl: subscriber.subscriberUrl,
            subscriber,
            triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
          })
        );
      }
    }

    await Promise.all([deleteWebhookScheduledTriggerPromise, ...scheduleTriggerPromises]).catch((error) => {
      loggerWithEventDetails.error(
        "Error while scheduling or canceling webhook triggers",
        JSON.stringify({ error })
      );
    });

    // Send Webhook call if hooked to BOOKING_CREATED & BOOKING_RESCHEDULED
    await handleWebhookTrigger({ subscriberOptions, eventTrigger, webhookData });
  } else {
    // if eventType requires confirmation we will trigger the BOOKING REQUESTED Webhook
    const eventTrigger: WebhookTriggerEvents = WebhookTriggerEvents.BOOKING_REQUESTED;
    subscriberOptions.triggerEvent = eventTrigger;
    webhookData.status = "PENDING";
    await handleWebhookTrigger({ subscriberOptions, eventTrigger, webhookData });
  }

  // Avoid passing referencesToCreate with id unique constrain values
  // refresh hashed link if used
  const urlSeed = `${organizerUser.username}:${dayjs(reqBody.start).utc().format()}`;
  const hashedUid = translator.fromUUID(uuidv5(urlSeed, uuidv5.URL));

  try {
    if (hasHashedBookingLink) {
      await prisma.hashedLink.update({
        where: {
          link: reqBody.hashedLink as string,
        },
        data: {
          link: hashedUid,
        },
      });
    }
  } catch (error) {
    loggerWithEventDetails.error("Error while updating hashed link", JSON.stringify({ error }));
  }

  if (!booking) throw new HttpError({ statusCode: 400, message: "Booking failed" });

  try {
    await prisma.booking.update({
      where: {
        uid: booking.uid,
      },
      data: {
        location: evt.location,
        metadata: { ...(typeof booking.metadata === "object" && booking.metadata), ...metadata },
        references: {
          createMany: {
            data: referencesToCreate,
          },
        },
      },
    });
  } catch (error) {
    loggerWithEventDetails.error("Error while creating booking references", JSON.stringify({ error }));
  }

  const evtWithMetadata = {
    ...evt,
    metadata,
    eventType: { slug: eventType.slug, schedulingType: eventType.schedulingType, hosts: eventType.hosts },
    bookerUrl,
  };

  if (!eventType.metadata?.disableStandardEmails?.all?.attendee) {
    await scheduleMandatoryReminder(
      evtWithMetadata,
      workflows,
      !isConfirmedByDefault,
      !!eventType.owner?.hideBranding,
      evt.attendeeSeatId
    );
  }

  try {
    await scheduleWorkflowReminders({
      workflows,
      smsReminderNumber: smsReminderNumber || null,
      calendarEvent: evtWithMetadata,
      isNotConfirmed: rescheduleUid ? false : !isConfirmedByDefault,
      isRescheduleEvent: !!rescheduleUid,
      isFirstRecurringEvent: req.body.allRecurringDates ? req.body.isFirstRecurringSlot : undefined,
      hideBranding: !!eventType.owner?.hideBranding,
      seatReferenceUid: evt.attendeeSeatId,
      //TODO:NOSHOW ,Don't need to specify the bookerID, as for SMS/Whatsapp we create the
      // data from the booking booker present in workflowReminder.booking.attendees[0]
      // bookerId: attendeeMap[bookerEmail],
    });
  } catch (error) {
    loggerWithEventDetails.error("Error while scheduling workflow reminders", JSON.stringify({ error }));
  }

  // booking successful
  req.statusCode = 201;

  // TODO: Refactor better so this booking object is not passed
  // all around and instead the individual fields are sent as args.
  const bookingResponse = {
    ...booking,
    user: {
      ...booking.user,
      email: null,
    },
    paymentRequired: false,
  };

  if (
    booking.status === BookingStatus.ACCEPTED &&
    isPrismaObjOrUndefined(organizerUser.metadata)?.connectedChatAccounts
  ) {
    await handleOHChatSync({
      userId: organizerUser.id,
      booking: {
        hostName: organizerUser.name ?? "Cal User",
        bookingLocation,
        // bookingLocation:evt.location,
        bookingEventType: eventType.title,
        bookingStartTime: evt.startTime,
        bookingEndTime: evt.endTime,
        bookerEmail,
        bookerPhone: bookerPhoneNumber,
        bookingUid: booking.uid,
        ...(originalRescheduledBooking?.uid && { originalBookingUid: originalRescheduledBooking?.uid }),
      },
    });
  }

  return {
    ...bookingResponse,
    ...luckyUserResponse,
    references: referencesToCreate,
    seatReferenceUid: evt.attendeeSeatId,
  };
}

export default handler;

function getVideoCallDetails({
  results,
}: {
  results: EventResult<AdditionalInformation & { url?: string | undefined; iCalUID?: string | undefined }>[];
}) {
  const firstVideoResult = results.find((result) => result.type.includes("_video"));
  const metadata: AdditionalInformation = {};
  let updatedVideoEvent = null;

  if (firstVideoResult && firstVideoResult.success) {
    updatedVideoEvent = Array.isArray(firstVideoResult.updatedEvent)
      ? firstVideoResult.updatedEvent[0]
      : firstVideoResult.updatedEvent;

    if (updatedVideoEvent) {
      metadata.hangoutLink = updatedVideoEvent.hangoutLink;
      metadata.conferenceData = updatedVideoEvent.conferenceData;
      metadata.entryPoints = updatedVideoEvent.entryPoints;
    }
  }
  const videoCallUrl = metadata.hangoutLink || updatedVideoEvent?.url;

  return { videoCallUrl, metadata, updatedVideoEvent };
}

async function handleOHChatSync({
  userId,
  booking,
}: {
  userId: number;
  booking: {
    hostName: string;
    bookingLocation: string;
    bookingEventType: string;
    bookingStartTime: string;
    bookingEndTime: string;
    bookingUid: string;
    bookerEmail?: string;
    bookerPhone?: string;
    originalBookingUid?: string;
  };
}) {
  const credentials = await prisma.credential.findMany({
    where: {
      appId: "onehash-chat",
      userId,
    },
  });

  if (credentials.length == 0) return Promise.resolve();

  const account_user_ids: number[] = credentials.reduce<number[]>((acc, cred) => {
    const accountUserId = isPrismaObjOrUndefined(cred.key)?.account_user_id as number | undefined;
    if (accountUserId !== undefined) {
      acc.push(accountUserId);
    }
    return acc;
  }, []);
  const data = {
    account_user_ids,
    booking,
  };

  await fetch(`${ONEHASH_CHAT_SYNC_BASE_URL}/cal_booking`, {
    method: booking.originalBookingUid ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ONEHASH_API_KEY}`,
    },
    body: JSON.stringify(data),
  });
}
