import type { Prisma } from "@prisma/client";
import type { NextApiRequest } from "next";

import bookingCancelPaymentHandler from "@calcom/app-store/_utils/payments/bookingCancelPaymentHandler";
import EventManager from "@calcom/core/EventManager";
import dayjs from "@calcom/dayjs";
import { sendCancelledEmails } from "@calcom/emails";
import { getCalEventResponses } from "@calcom/features/bookings/lib/getCalEventResponses";
import { deleteScheduledEmailReminder } from "@calcom/features/oe/workflows/lib/reminders/managers/emailReminderManager";
import { deleteScheduledSMSReminder } from "@calcom/features/oe/workflows/lib/reminders/managers/smsReminderManager";
import { deleteScheduledWhatsappReminder } from "@calcom/features/oe/workflows/lib/reminders/managers/whatsappReminderManager";
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import { deleteWebhookScheduledTriggers } from "@calcom/features/webhooks/lib/scheduleTrigger";
import sendPayload from "@calcom/features/webhooks/lib/sendOrSchedulePayload";
import type { EventTypeInfo } from "@calcom/features/webhooks/lib/sendPayload";
import { isPrismaObjOrUndefined, parseRecurringEvent } from "@calcom/lib";
import getOrgIdFromMemberOrTeamId from "@calcom/lib/getOrgIdFromMemberOrTeamId";
import { getTeamIdFromEventType } from "@calcom/lib/getTeamIdFromEventType";
import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { getTranslation } from "@calcom/lib/server/i18n";
import { getTimeFormatStringFromUserTimeFormat } from "@calcom/lib/timeFormat";
import prisma, { bookingMinimalSelect } from "@calcom/prisma";
import type { WebhookTriggerEvents } from "@calcom/prisma/enums";
import { BookingStatus, WorkflowMethods } from "@calcom/prisma/enums";
import { credentialForCalendarServiceSelect } from "@calcom/prisma/selects/credential";
import { schemaBookingCancelParams, EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import type { CalendarEvent } from "@calcom/types/Calendar";

import { getAllCredentials } from "./getAllCredentialsForUsersOnEvent/getAllCredentials";
import cancelAttendeeSeat from "./handleSeats/cancel/cancelAttendeeSeat";

const log = logger.getSubLogger({ prefix: ["handleCancelBooking"] });

async function getBookingToDelete(id: number | undefined, uid: string | undefined) {
  return await prisma.booking.findUnique({
    where: {
      id,
      uid,
    },
    select: {
      ...bookingMinimalSelect,
      recurringEventId: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          credentials: { select: credentialForCalendarServiceSelect },
          email: true,
          timeZone: true,
          timeFormat: true,
          name: true,
          destinationCalendar: true,
        },
      },
      location: true,
      references: {
        select: {
          uid: true,
          type: true,
          externalCalendarId: true,
          credentialId: true,
          thirdPartyRecurringEventId: true,
        },
      },
      payment: true,
      paid: true,
      eventType: {
        select: {
          slug: true,
          owner: {
            select: {
              id: true,
              hideBranding: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              parentId: true,
            },
          },
          parentId: true,
          userId: true,
          recurringEvent: true,
          title: true,
          eventName: true,
          description: true,
          requiresConfirmation: true,
          price: true,
          currency: true,
          length: true,
          seatsPerTimeSlot: true,
          bookingFields: true,
          seatsShowAttendees: true,
          metadata: true,
          hosts: {
            select: {
              user: true,
            },
          },
          workflows: {
            include: {
              workflow: {
                include: {
                  steps: true,
                },
              },
            },
          },
        },
      },
      uid: true,
      id: true,
      eventTypeId: true,
      destinationCalendar: true,
      smsReminderNumber: true,
      workflowReminders: true,
      scheduledJobs: true,
      seatsReferences: true,
      responses: true,
      iCalUID: true,
      iCalSequence: true,
    },
  });
}

export type CustomRequest = NextApiRequest & {
  userId?: number;
  bookingToDelete?: Awaited<ReturnType<typeof getBookingToDelete>>;
  platformClientId?: string;
  platformRescheduleUrl?: string;
  platformCancelUrl?: string;
  platformBookingUrl?: string;
  arePlatformEmailsEnabled?: boolean;
};

async function handler(req: CustomRequest) {
  const { id, uid, allRemainingBookings, cancellationReason, seatReferenceUid, autorefund } =
    schemaBookingCancelParams.parse(req.body);
  req.bookingToDelete = await getBookingToDelete(id, uid);
  const {
    bookingToDelete,
    userId,
    platformBookingUrl,
    platformCancelUrl,
    platformClientId,
    platformRescheduleUrl,
    arePlatformEmailsEnabled,
  } = req;

  if (!bookingToDelete || !bookingToDelete.user) {
    throw new HttpError({ statusCode: 400, message: "Booking not found" });
  }

  if (!bookingToDelete.userId) {
    throw new HttpError({ statusCode: 400, message: "User not found" });
  }

  if (bookingToDelete.eventType?.seatsPerTimeSlot && !seatReferenceUid) {
    const userIsHost = bookingToDelete.eventType.hosts.some((host) => host.user.id === userId);
    const userIsOwnerOfEventType = bookingToDelete.eventType.owner?.id === userId;

    if (!userIsHost && !userIsOwnerOfEventType) {
      throw new HttpError({ statusCode: 401, message: "User not a host of this event" });
    }
  }

  const eventTrigger: WebhookTriggerEvents = "BOOKING_CANCELLED";
  const teamId = await getTeamIdFromEventType({
    eventType: {
      team: { id: bookingToDelete.eventType?.team?.id ?? null },
      parentId: bookingToDelete?.eventType?.parentId ?? null,
    },
  });
  const triggerForUser = !teamId || (teamId && bookingToDelete.eventType?.parentId);
  const organizerUserId = triggerForUser ? bookingToDelete.userId : null;
  const orgId = await getOrgIdFromMemberOrTeamId({ memberId: organizerUserId, teamId });
  const subscriberOptions = {
    userId: organizerUserId,
    eventTypeId: bookingToDelete.eventTypeId as number,
    triggerEvent: eventTrigger,
    teamId,
    orgId,
  };
  const eventTypeInfo: EventTypeInfo = {
    eventTitle: bookingToDelete?.eventType?.title || null,
    eventDescription: bookingToDelete?.eventType?.description || null,
    requiresConfirmation: bookingToDelete?.eventType?.requiresConfirmation || null,
    price: bookingToDelete?.eventType?.price || null,
    currency: bookingToDelete?.eventType?.currency || null,
    length: bookingToDelete?.eventType?.length || null,
  };
  const webhooks = await getWebhooks(subscriberOptions);
  const organizer = await prisma.user.findFirstOrThrow({
    where: {
      id: bookingToDelete.userId,
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      timeZone: true,
      timeFormat: true,
      locale: true,
    },
  });

  const teamMembersPromises = [];
  const attendeesListPromises = [];
  const hostsPresent = !!bookingToDelete.eventType?.hosts;

  for (const attendee of bookingToDelete.attendees) {
    const attendeeObject = {
      name: attendee.name,
      email: attendee.email,
      timeZone: attendee.timeZone,
      language: {
        translate: await getTranslation(attendee.locale ?? "en", "common"),
        locale: attendee.locale ?? "en",
      },
    };

    if (hostsPresent) {
      const teamMember = bookingToDelete.eventType?.hosts.some((host) => host.user.email === attendee.email);
      if (teamMember) {
        teamMembersPromises.push(attendeeObject);
      } else {
        attendeesListPromises.push(attendeeObject);
      }
    } else {
      attendeesListPromises.push(attendeeObject);
    }
  }

  const attendeesList = await Promise.all(attendeesListPromises);
  const teamMembers = await Promise.all(teamMembersPromises);
  const tOrganizer = await getTranslation(organizer.locale ?? "en", "common");

  const evt: CalendarEvent = {
    title: bookingToDelete?.title,
    type: bookingToDelete?.eventType?.title as string,
    description: bookingToDelete?.description || "",
    customInputs: isPrismaObjOrUndefined(bookingToDelete.customInputs),
    eventTypeId: bookingToDelete.eventTypeId as number,
    ...getCalEventResponses({
      bookingFields: bookingToDelete.eventType?.bookingFields ?? null,
      booking: bookingToDelete,
    }),
    startTime: bookingToDelete?.startTime ? dayjs(bookingToDelete.startTime).format() : "",
    endTime: bookingToDelete?.endTime ? dayjs(bookingToDelete.endTime).format() : "",
    organizer: {
      id: organizer.id,
      username: organizer.username || undefined,
      email: bookingToDelete?.userPrimaryEmail ?? organizer.email,
      name: organizer.name ?? "Nameless",
      timeZone: organizer.timeZone,
      timeFormat: getTimeFormatStringFromUserTimeFormat(organizer.timeFormat),
      language: { translate: tOrganizer, locale: organizer.locale ?? "en" },
    },
    attendees: attendeesList,
    uid: bookingToDelete?.uid,
    bookingId: bookingToDelete?.id,
    recurringEvent: allRemainingBookings
      ? parseRecurringEvent(bookingToDelete.eventType?.recurringEvent)
      : undefined,
    location: bookingToDelete?.location,
    destinationCalendar: bookingToDelete?.destinationCalendar
      ? [bookingToDelete?.destinationCalendar]
      : bookingToDelete?.user.destinationCalendar
      ? [bookingToDelete?.user.destinationCalendar]
      : [],
    cancellationReason: cancellationReason,
    ...(teamMembers && {
      team: { name: bookingToDelete?.eventType?.team?.name || "Nameless", members: teamMembers, id: teamId! },
    }),
    seatsPerTimeSlot: bookingToDelete.eventType?.seatsPerTimeSlot,
    seatsShowAttendees: bookingToDelete.eventType?.seatsShowAttendees,
    iCalUID: bookingToDelete.iCalUID,
    iCalSequence: bookingToDelete.iCalSequence + 1,
    platformClientId,
    platformRescheduleUrl,
    platformCancelUrl,
    platformBookingUrl,
  };

  const dataForWebhooks = { evt, webhooks, eventTypeInfo };

  // If it's just an attendee of a booking then just remove them from that booking
  const result = await cancelAttendeeSeat(req, dataForWebhooks);
  if (result) return { success: true };

  let workflowReminderPromises: Promise<void>[] = [];
  let webhookTriggerPromises: Promise<void>[] = [];
  await prisma
    .$transaction(
      async (prismaTransaction) => {
        const promises = webhooks.map((webhook) =>
          sendPayload(webhook.secret, eventTrigger, new Date().toISOString(), webhook, {
            ...evt,
            ...eventTypeInfo,
            status: "CANCELLED",
            smsReminderNumber: bookingToDelete.smsReminderNumber || undefined,
          }).catch((e) => {
            log.error(
              `Error executing webhook for event: ${eventTrigger}, URL: ${webhook.subscriberUrl}, bookingId: ${evt.bookingId}, bookingUid: ${evt.uid}`,
              safeStringify(e)
            );
          })
        );

        await Promise.all(promises);

        // Handle updated bookings
        let updatedBookings: any[] = [];
        const updatedBookingSelect = {
          id: true,
          startTime: true,
          endTime: true,
          references: {
            select: {
              uid: true,
              type: true,
              externalCalendarId: true,
              credentialId: true,
            },
          },
          workflowReminders: true,
          uid: true,
          payment: true,
          eventType: {
            select: {
              teamId: true,
              owner: true,
            },
          },
          metadata: true,
        };
        if (
          bookingToDelete.eventType?.recurringEvent &&
          bookingToDelete.recurringEventId &&
          allRemainingBookings
        ) {
          const recurringEventId = bookingToDelete.recurringEventId;
          await prismaTransaction.booking.updateMany({
            where: {
              recurringEventId,
              startTime: {
                gte: new Date(),
              },
            },
            data: {
              status: BookingStatus.CANCELLED,
              cancellationReason: cancellationReason,
            },
          });
          const allUpdatedBookings = await prismaTransaction.booking.findMany({
            where: {
              recurringEventId: bookingToDelete.recurringEventId,
              startTime: {
                gte: new Date(),
              },
            },
            select: updatedBookingSelect,
          });
          updatedBookings = updatedBookings.concat(allUpdatedBookings);
        } else {
          if (bookingToDelete?.eventType?.seatsPerTimeSlot) {
            await prismaTransaction.attendee.deleteMany({
              where: {
                bookingId: bookingToDelete.id,
              },
            });
          }

          const where: Prisma.BookingWhereUniqueInput = uid ? { uid } : { id };

          const updatedBooking = await prismaTransaction.booking.update({
            where,
            data: {
              status: BookingStatus.CANCELLED,
              cancellationReason: cancellationReason,
              iCalSequence: evt.iCalSequence || 100,
            },
            select: updatedBookingSelect,
          });
          updatedBookings.push(updatedBooking);
        }

        if (autorefund) {
          const paymentCancellationPromises = updatedBookings.map((booking) => {
            if (!booking.payment) {
              log.warn(`No payment found for booking ${booking.id}`);
              return Promise.resolve();
            }
            const cancelPaymentPromise = bookingCancelPaymentHandler({
              payment: booking.payment,
              eventType: booking.eventType,
            });

            const updateBookingPromise = prismaTransaction.booking.update({
              where: {
                id: booking.id,
              },
              data: {
                metadata: {
                  ...booking.metadata,
                  paymentStatus: "refunded",
                },
              },
            });

            return Promise.all([cancelPaymentPromise, updateBookingPromise]);
          });

          await Promise.all(paymentCancellationPromises);
        }

        // Handle webhook and workflow reminders deletion outside of the transaction
        webhookTriggerPromises = updatedBookings.map((booking) =>
          deleteWebhookScheduledTriggers({ booking })
        );

        workflowReminderPromises = updatedBookings.flatMap((booking) =>
          booking.workflowReminders.map((reminder) => {
            if (reminder.method === WorkflowMethods.EMAIL) {
              return deleteScheduledEmailReminder(reminder.id, reminder.referenceId);
            } else if (reminder.method === WorkflowMethods.SMS) {
              return deleteScheduledSMSReminder(reminder.id, reminder.referenceId);
            } else if (reminder.method === WorkflowMethods.WHATSAPP) {
              return deleteScheduledWhatsappReminder(reminder.id, reminder.referenceId);
            }
          })
        );
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    )
    .catch((error) => {
      log.error("Transaction failed", error);
      throw new HttpError({ statusCode: 500, message: "Internal server error" });
    });

  const isBookingInRecurringSeries = !!(
    bookingToDelete.eventType?.recurringEvent &&
    bookingToDelete.recurringEventId &&
    allRemainingBookings
  );
  const bookingToDeleteEventTypeMetadata = EventTypeMetaDataSchema.parse(
    bookingToDelete.eventType?.metadata || null
  );

  const credentials = await getAllCredentials(bookingToDelete.user, {
    ...bookingToDelete.eventType,
    metadata: bookingToDeleteEventTypeMetadata,
  });

  const eventManager = new EventManager({ ...bookingToDelete.user, credentials });

  await eventManager.cancelEvent(evt, bookingToDelete.references, isBookingInRecurringSeries);

  await Promise.all([...webhookTriggerPromises, ...workflowReminderPromises]);

  if (!platformClientId || (platformClientId && arePlatformEmailsEnabled)) {
    await sendCancelledEmails(evt, { eventName: bookingToDelete?.eventType?.eventName });
  }

  req.statusCode = 200;
  return { message: "Booking successfully cancelled." };
}
export default handler;
