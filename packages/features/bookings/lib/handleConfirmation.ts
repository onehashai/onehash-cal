import type { Workflow } from "@onehash/oe-features/workflows/config/types";
import {
  canDisableParticipantNotifications,
  canDisableOrganizerNotifications,
} from "@onehash/oe-features/workflows/utils/notificationDisableCheck";
import { scheduleWorkflowReminders } from "@onehash/oe-features/workflows/utils/reminderScheduler";
import { scheduleMandatoryReminder } from "@onehash/oe-features/workflows/utils/scheduleMandatoryReminder";
import type { Prisma } from "@prisma/client";

import type { EventManagerUser } from "@calcom/core/EventManager";
import EventManager from "@calcom/core/EventManager";
import { sendScheduledEmailsAndSMS } from "@calcom/emails";
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import { scheduleTrigger } from "@calcom/features/webhooks/lib/scheduleTrigger";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";
import type { EventPayloadType, EventTypeInfo } from "@calcom/features/webhooks/lib/sendPayload";
import { getVideoCallUrlFromCalEvent } from "@calcom/lib/CalEventParser";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import getOrgIdFromMemberOrTeamId from "@calcom/lib/getOrgIdFromMemberOrTeamId";
import { getTeamIdFromEventType } from "@calcom/lib/getTeamIdFromEventType";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import type { PrismaClient } from "@calcom/prisma";
import type { SchedulingType } from "@calcom/prisma/enums";
import { BookingStatus, WebhookTriggerEvents } from "@calcom/prisma/enums";
import type { PlatformClientParams } from "@calcom/prisma/zod-utils";
import { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import { getAllWorkflowsFromEventType } from "@calcom/trpc/server/routers/viewer/workflows/util";
import type { AdditionalInformation, CalendarEvent } from "@calcom/types/Calendar";

import { scheduleNoShowTriggers } from "./handleNewBooking/scheduleNoShowTriggers";

const log = logger.getSubLogger({ prefix: ["[handleConfirmation] book:user"] });

export async function handleConfirmation(args: {
  user: EventManagerUser & { username: string | null };
  evt: CalendarEvent;
  recurringEventId?: string;
  prisma: PrismaClient;
  bookingId: number;
  booking: {
    startTime: Date;
    id: number;
    eventType: {
      currency: string;
      description: string | null;
      id: number;
      length: number;
      price: number;
      requiresConfirmation: boolean;
      metadata?: Prisma.JsonValue;
      title: string;
      team?: {
        parentId: number | null;
      } | null;
      teamId?: number | null;
      parentId?: number | null;
      parent?: {
        teamId: number | null;
      } | null;
      workflows?: {
        workflow: Workflow;
      }[];
    } | null;
    metadata?: Prisma.JsonValue;
    eventTypeId: number | null;
    smsReminderNumber: string | null;
    userId?: number | null;
  };
  paid?: boolean;
  emailsEnabled?: boolean;
  platformClientParams?: PlatformClientParams;
}) {
  const {
    user,
    evt,
    recurringEventId,
    prisma,
    bookingId,
    booking,
    paid,
    emailsEnabled = true,
    platformClientParams,
  } = args;
  const eventType = booking.eventType;
  const eventTypeMetadata = EventTypeMetaDataSchema.parse(eventType?.metadata || {});
  const eventManager = new EventManager(user, eventTypeMetadata?.apps);
  const scheduleResult = await eventManager.create(evt);
  const results = scheduleResult.results;
  const metadata: AdditionalInformation = {};

  const workflows = await getAllWorkflowsFromEventType(eventType, booking.userId);

  if (results.length > 0 && results.every((res) => !res.success)) {
    const error = {
      errorCode: "BookingCreatingMeetingFailed",
      message: "Booking failed",
    };

    log.error(`Booking ${user.username} failed`, safeStringify({ error, results }));
  } else {
    if (results.length) {
      // TODO: Handle created event metadata more elegantly
      metadata.hangoutLink = results[0].createdEvent?.hangoutLink;
      metadata.conferenceData = results[0].createdEvent?.conferenceData;
      metadata.entryPoints = results[0].createdEvent?.entryPoints;
    }
    try {
      const eventType = booking.eventType;

      let isHostConfirmationEmailsDisabled = false;
      let isAttendeeConfirmationEmailDisabled = false;

      if (workflows) {
        isHostConfirmationEmailsDisabled =
          eventTypeMetadata?.disableStandardEmails?.confirmation?.host || false;
        isAttendeeConfirmationEmailDisabled =
          eventTypeMetadata?.disableStandardEmails?.confirmation?.attendee || false;

        if (isHostConfirmationEmailsDisabled) {
          isHostConfirmationEmailsDisabled = canDisableOrganizerNotifications(workflows);
        }

        if (isAttendeeConfirmationEmailDisabled) {
          isAttendeeConfirmationEmailDisabled = canDisableParticipantNotifications(workflows);
        }
      }

      if (emailsEnabled) {
        await sendScheduledEmailsAndSMS(
          { ...evt, additionalInformation: metadata },
          undefined,
          isHostConfirmationEmailsDisabled,
          isAttendeeConfirmationEmailDisabled,
          eventTypeMetadata
        );
      }
    } catch (error) {
      log.error(error);
    }
  }
  let updatedBookings: {
    id: number;
    description: string | null;
    location: string | null;
    attendees: {
      name: string;
      email: string;
      phoneNumber?: string | null;
    }[];
    startTime: Date;
    endTime: Date;
    uid: string;
    smsReminderNumber: string | null;
    metadata: Prisma.JsonValue | null;
    customInputs: Prisma.JsonValue;
    eventType: {
      bookingFields: Prisma.JsonValue | null;
      slug: string;
      schedulingType: SchedulingType | null;
      hosts: {
        user: {
          email: string;
          destinationCalendar?: {
            primaryEmail: string | null;
          } | null;
        };
      }[];
      owner: {
        hideBranding?: boolean | null;
      } | null;
    } | null;
  }[] = [];

  const videoCallUrl = metadata.hangoutLink ? metadata.hangoutLink : evt.videoCallData?.url || "";
  const meetingUrl = getVideoCallUrlFromCalEvent(evt) || videoCallUrl;

  if (recurringEventId) {
    // The booking to confirm is a recurring event and comes from /booking/recurring, proceeding to mark all related
    // bookings as confirmed. Prisma updateMany does not support relations, so doing this in two steps for now.
    const unconfirmedRecurringBookings = await prisma.booking.findMany({
      where: {
        recurringEventId,
        status: BookingStatus.PENDING,
      },
    });

    const updateBookingsPromise = unconfirmedRecurringBookings.map((recurringBooking) =>
      prisma.booking.update({
        where: {
          id: recurringBooking.id,
        },
        data: {
          status: BookingStatus.ACCEPTED,
          references: {
            create: scheduleResult.referencesToCreate,
          },
          paid,
          metadata: {
            ...(typeof recurringBooking.metadata === "object" ? recurringBooking.metadata : {}),
            videoCallUrl: meetingUrl,
          },
        },
        select: {
          eventType: {
            select: {
              slug: true,
              bookingFields: true,
              schedulingType: true,
              hosts: {
                select: {
                  user: {
                    select: {
                      email: true,
                      destinationCalendar: {
                        select: {
                          primaryEmail: true,
                        },
                      },
                    },
                  },
                },
              },
              owner: {
                select: {
                  hideBranding: true,
                },
              },
            },
          },
          description: true,
          attendees: true,
          location: true,
          uid: true,
          startTime: true,
          metadata: true,
          endTime: true,
          smsReminderNumber: true,
          customInputs: true,
          id: true,
        },
      })
    );

    const updatedBookingsResult = await Promise.all(updateBookingsPromise);
    updatedBookings = updatedBookings.concat(updatedBookingsResult);
  } else {
    // @NOTE: be careful with this as if any error occurs before this booking doesn't get confirmed
    // Should perform update on booking (confirm) -> then trigger the rest handlers
    const updatedBooking = await prisma.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status: BookingStatus.ACCEPTED,
        references: {
          create: scheduleResult.referencesToCreate,
        },
        metadata: {
          ...(typeof booking.metadata === "object" ? booking.metadata : {}),
          videoCallUrl: meetingUrl,
        },
      },
      select: {
        eventType: {
          select: {
            slug: true,
            bookingFields: true,
            schedulingType: true,
            owner: {
              select: {
                hideBranding: true,
              },
            },
            hosts: {
              select: {
                user: {
                  select: {
                    email: true,
                    destinationCalendar: {
                      select: {
                        primaryEmail: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        uid: true,
        startTime: true,
        metadata: true,
        endTime: true,
        smsReminderNumber: true,
        description: true,
        attendees: true,
        location: true,
        customInputs: true,
        id: true,
      },
    });
    updatedBookings.push(updatedBooking);
  }

  const teamId = await getTeamIdFromEventType({
    eventType: {
      team: { id: eventType?.teamId ?? null },
      parentId: eventType?.parentId ?? null,
    },
  });

  const triggerForUser = !teamId || (teamId && eventType?.parentId);

  const userId = triggerForUser ? booking.userId : null;

  const orgId = await getOrgIdFromMemberOrTeamId({ memberId: userId, teamId });

  const bookerUrl = await getBookerBaseUrl(orgId ?? null);

  //Workflows - set reminders for confirmed events
  try {
    for (let index = 0; index < updatedBookings.length; index++) {
      const eventTypeSlug = updatedBookings[index].eventType?.slug || "";
      const evtOfBooking = {
        ...evt,
        metadata: { videoCallUrl: meetingUrl },
        eventType: {
          slug: eventTypeSlug,
          schedulingType: updatedBookings[index].eventType?.schedulingType,
          hosts: updatedBookings[index].eventType?.hosts,
          title: eventType?.title,
        },
        bookerUrl,
      };
      evtOfBooking.startTime = updatedBookings[index].startTime.toISOString();
      evtOfBooking.endTime = updatedBookings[index].endTime.toISOString();
      evtOfBooking.uid = updatedBookings[index].uid;
      const isFirstBooking = index === 0;

      if (!eventTypeMetadata?.disableStandardEmails?.all?.attendee) {
        await scheduleMandatoryReminder(
          evtOfBooking,
          workflows,
          false,
          !!updatedBookings[index].eventType?.owner?.hideBranding,
          evt.attendeeSeatId,
          !emailsEnabled && Boolean(platformClientParams?.platformClientId)
        );
      }

      await scheduleWorkflowReminders({
        workflows,
        smsReminderNumber: updatedBookings[index].smsReminderNumber,
        calendarEvent: {
          ...evtOfBooking,
          eventType: {
            ...(evtOfBooking.eventType || {}),
            id: eventType?.id,
          },
        },
        isFirstRecurringEvent: isFirstBooking,
        hideBranding: !!updatedBookings[index].eventType?.owner?.hideBranding,
      });
    }
  } catch (error) {
    // Silently fail
    console.error(error);
  }

  try {
    const subscribersBookingCreated = await getWebhooks({
      userId,
      eventTypeId: booking.eventTypeId,
      triggerEvent: WebhookTriggerEvents.BOOKING_CREATED,
      teamId,
      orgId,
      oAuthClientId: platformClientParams?.platformClientId,
    });
    const subscribersMeetingStarted = await getWebhooks({
      userId,
      eventTypeId: booking.eventTypeId,
      triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
      teamId: eventType?.teamId,
      orgId,
      oAuthClientId: platformClientParams?.platformClientId,
    });
    const subscribersMeetingEnded = await getWebhooks({
      userId,
      eventTypeId: booking.eventTypeId,
      triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
      teamId: eventType?.teamId,
      orgId,
      oAuthClientId: platformClientParams?.platformClientId,
    });

    const scheduleTriggerPromises: Promise<unknown>[] = [];

    subscribersMeetingStarted.forEach((subscriber) => {
      updatedBookings.forEach((booking) => {
        scheduleTriggerPromises.push(
          scheduleTrigger({
            booking,
            subscriberUrl: subscriber.subscriberUrl,
            subscriber,
            triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
          })
        );
      });
    });
    subscribersMeetingEnded.forEach((subscriber) => {
      updatedBookings.forEach((booking) => {
        scheduleTriggerPromises.push(
          scheduleTrigger({
            booking,
            subscriberUrl: subscriber.subscriberUrl,
            subscriber,
            triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
          })
        );
      });
    });

    await Promise.all(scheduleTriggerPromises);

    await scheduleNoShowTriggers({
      booking: {
        startTime: booking.startTime,
        id: booking.id,
      },
      triggerForUser,
      organizerUser: { id: booking.userId ?? null },
      eventTypeId: booking.eventTypeId,
      teamId,
      orgId,
      oAuthClientId: platformClientParams?.platformClientId,
    });

    const eventTypeInfo: EventTypeInfo = {
      eventTitle: eventType?.title,
      eventDescription: eventType?.description,
      requiresConfirmation: eventType?.requiresConfirmation || null,
      price: eventType?.price,
      currency: eventType?.currency,
      length: eventType?.length,
    };

    const payload: EventPayloadType = {
      ...evt,
      ...eventTypeInfo,
      bookingId,
      eventTypeId: eventType?.id,
      status: "ACCEPTED",
      smsReminderNumber: booking.smsReminderNumber || undefined,
      metadata: meetingUrl ? { videoCallUrl: meetingUrl } : undefined,
      ...(platformClientParams ? platformClientParams : {}),
    };

    const promises = subscribersBookingCreated.map((sub) =>
      sendPayload(
        sub.secret,
        WebhookTriggerEvents.BOOKING_CREATED,
        new Date().toISOString(),
        sub,
        payload
      ).catch((e) => {
        log.error(
          `Error executing webhook for event: ${WebhookTriggerEvents.BOOKING_CREATED}, URL: ${sub.subscriberUrl}, bookingId: ${evt.bookingId}, bookingUid: ${evt.uid}, platformClientId: ${platformClientParams?.platformClientId}`,
          safeStringify(e)
        );
      })
    );

    await Promise.all(promises);

    if (paid) {
      let paymentExternalId: string | undefined;
      const subscriberMeetingPaid = await getWebhooks({
        userId,
        eventTypeId: booking.eventTypeId,
        triggerEvent: WebhookTriggerEvents.BOOKING_PAID,
        teamId: eventType?.teamId,
        orgId,
        oAuthClientId: platformClientParams?.platformClientId,
      });
      const bookingWithPayment = await prisma.booking.findFirst({
        where: {
          id: bookingId,
        },
        select: {
          payment: {
            select: {
              id: true,
              success: true,
              externalId: true,
            },
          },
        },
      });
      const successPayment = bookingWithPayment?.payment?.find((item) => item.success);
      if (successPayment) {
        paymentExternalId = successPayment.externalId;
      }

      const paymentMetadata = {
        identifier: "cal.com",
        bookingId,
        eventTypeId: eventType?.id,
        bookerEmail: evt.attendees[0].email,
        eventTitle: eventType?.title,
        externalId: paymentExternalId,
      };

      payload.paymentId = bookingWithPayment?.payment?.[0].id;
      payload.metadata = {
        ...(paid ? paymentMetadata : {}),
      };

      const bookingPaidSubscribers = subscriberMeetingPaid.map((sub) =>
        sendPayload(
          sub.secret,
          WebhookTriggerEvents.BOOKING_PAID,
          new Date().toISOString(),
          sub,
          payload
        ).catch((e) => {
          log.error(
            `Error executing webhook for event: ${WebhookTriggerEvents.BOOKING_PAID}, URL: ${sub.subscriberUrl}, bookingId: ${evt.bookingId}, bookingUid: ${evt.uid}`,
            safeStringify(e)
          );
        })
      );

      // I don't need to await for this
      Promise.all(bookingPaidSubscribers);
    }
  } catch (error) {
    // Silently fail
    console.error(error);
  }
}
