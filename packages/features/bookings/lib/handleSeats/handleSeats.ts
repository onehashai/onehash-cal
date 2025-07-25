// eslint-disable-next-line no-restricted-imports
import { scheduleWorkflowReminders } from "@onehash/oe-features/workflows/utils/reminderScheduler";

import dayjs from "@calcom/dayjs";
import { handleWebhookTrigger } from "@calcom/features/bookings/lib/handleWebhookTrigger";
import type { EventPayloadType } from "@calcom/features/webhooks/lib/sendPayload";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { HttpError } from "@calcom/lib/http-error";
import prisma from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";

import { createLoggerWithEventDetails } from "../handleNewBooking";
import createNewSeat from "./create/createNewSeat";
import rescheduleSeatedBooking from "./reschedule/rescheduleSeatedBooking";
import type { NewSeatedBookingObject, SeatedBooking, HandleSeatsResultBooking } from "./types";

const handleSeats = async (newSeatedBookingObject: NewSeatedBookingObject) => {
  const {
    eventType,
    reqBodyUser,
    rescheduleUid,
    reqBookingUid,
    invitee,
    bookerEmail,
    smsReminderNumber,
    eventTypeInfo,
    uid,
    originalRescheduledBooking,
    reqBodyMetadata,
    eventTypeId,
    subscriberOptions,
    eventTrigger,
    evt,
    workflows,
    rescheduledBy,
  } = newSeatedBookingObject;

  const loggerWithEventDetails = createLoggerWithEventDetails(eventType.id, reqBodyUser, eventType.slug);

  let resultBooking: HandleSeatsResultBooking = null;

  const seatedBooking: SeatedBooking | null = await prisma.booking.findFirst({
    where: {
      OR: [
        {
          uid: rescheduleUid || reqBookingUid,
        },

        {
          eventTypeId: eventType.id,
          startTime: new Date(evt.startTime),
        },
      ],
      status: BookingStatus.ACCEPTED,
    },
    select: {
      uid: true,
      id: true,
      attendees: { include: { bookingSeat: true } },
      userId: true,
      references: true,
      startTime: true,
      user: true,
      status: true,
      smsReminderNumber: true,
      endTime: true,
      metadata: true,
      responses: true,
    },
  });

  if (!seatedBooking && rescheduleUid) {
    throw new HttpError({ statusCode: 404, message: ErrorCode.BookingNotFound });
  }

  // We might be trying to create a new booking
  if (!seatedBooking) {
    return;
  }

  // See if attendee is already signed up for timeslot
  if (
    seatedBooking.attendees.find((attendee) => {
      return attendee.email === invitee[0].email;
    }) &&
    dayjs.utc(seatedBooking.startTime).format() === evt.startTime
  ) {
    throw new HttpError({ statusCode: 409, message: ErrorCode.AlreadySignedUpForBooking });
  }

  // There are two paths here, reschedule a booking with seats and booking seats without reschedule
  if (rescheduleUid) {
    resultBooking = await rescheduleSeatedBooking(
      // Assert that the rescheduleUid is defined
      { ...newSeatedBookingObject, rescheduleUid },
      seatedBooking,
      resultBooking,
      loggerWithEventDetails
    );
  } else {
    resultBooking = await createNewSeat(newSeatedBookingObject, seatedBooking, reqBodyMetadata);
  }

  // If the resultBooking is defined we should trigger workflows else, trigger in handleNewBooking
  if (resultBooking) {
    const metadata = {
      ...(typeof resultBooking.metadata === "object" && resultBooking.metadata),
      ...reqBodyMetadata,
    };

    const attendeeMap = resultBooking.attendees.reduce(
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
    try {
      await scheduleWorkflowReminders({
        workflows,
        smsReminderNumber: smsReminderNumber || null,
        calendarEvent: {
          ...evt,
          ...{
            metadata,
            eventType: {
              slug: eventType.slug,
              schedulingType: eventType.schedulingType,
              hosts: eventType.hosts,
              title: eventType.title,
              id: eventType.id,
            },
          },
        },
        isNotConfirmed: evt.requiresConfirmation || false,
        isRescheduleEvent: !!rescheduleUid,
        isFirstRecurringEvent: true,
        emailAttendeeSendToOverride: bookerEmail,
        seatReferenceUid: evt.attendeeSeatId,
      });
    } catch (error) {
      loggerWithEventDetails.error("Error while scheduling workflow reminders", JSON.stringify({ error }));
    }

    const webhookData: EventPayloadType = {
      ...evt,
      ...eventTypeInfo,
      uid: resultBooking?.uid || uid,
      bookingId: seatedBooking?.id,
      attendeeSeatId: resultBooking?.seatReferenceUid,
      rescheduleUid,
      rescheduleStartTime: originalRescheduledBooking?.startTime
        ? dayjs(originalRescheduledBooking?.startTime).utc().format()
        : undefined,
      rescheduleEndTime: originalRescheduledBooking?.endTime
        ? dayjs(originalRescheduledBooking?.endTime).utc().format()
        : undefined,
      metadata,
      eventTypeId,
      status: "ACCEPTED",
      smsReminderNumber: seatedBooking?.smsReminderNumber || undefined,
      rescheduledBy,
    };

    await handleWebhookTrigger({ subscriberOptions, eventTrigger, webhookData });
  }

  return resultBooking;
};

export default handleSeats;
