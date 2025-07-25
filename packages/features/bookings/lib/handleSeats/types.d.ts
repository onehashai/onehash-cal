import type { Workflow } from "@onehash/oe-features/workflows/config/types";
import type { Attendee, Prisma } from "@prisma/client";
import type z from "zod";

import type { AppsStatus, CalendarEvent } from "@calcom/types/Calendar";

import type {
  Booking,
  NewBookingEventType,
  OrganizerUser,
  OriginalRescheduledBooking,
} from "../handleNewBooking/types";

export type BookingSeat = Prisma.BookingSeatGetPayload<{ include: { booking: true; attendee: true } }> | null;

export type NewSeatedBookingObject = {
  rescheduleUid: string | undefined;
  reqBookingUid: string | undefined;
  eventType: NewBookingEventType;
  evt: Omit<CalendarEvent, "bookerUrl"> & {
    bookerUrl: string;
  };
  invitee: Invitee;
  allCredentials: Awaited<ReturnType<typeof getAllCredentials>>;
  organizerUser: OrganizerUser;
  originalRescheduledBooking: OriginalRescheduledBooking;
  bookerEmail: string;
  bookerPhoneNumber?: string | null;
  tAttendees: TFunction;
  bookingSeat: BookingSeat;
  reqUserId: number | undefined;
  rescheduleReason: RescheduleReason;
  reqBodyUser: string | string[] | undefined;
  noEmail: NoEmail;
  isConfirmedByDefault: boolean;
  additionalNotes: AdditionalNotes;
  reqAppsStatus: ReqAppsStatus;
  attendeeLanguage: string | null;
  paymentAppData: PaymentAppData;
  fullName: ReturnType<typeof getFullName>;
  smsReminderNumber: SmsReminderNumber;
  eventTypeInfo: EventTypeInfo;
  uid: short.SUUID;
  eventTypeId: EventTypeId;
  reqBodyMetadata: ReqBodyMetadata;
  subscriberOptions: GetSubscriberOptions;
  eventTrigger: WebhookTriggerEvents;
  responses: z.infer<ReturnType<typeof getBookingDataSchema>>["responses"] | null;
  rescheduledBy?: string;
  workflows: Workflow[];
};

export type RescheduleSeatedBookingObject = NewSeatedBookingObject & { rescheduleUid: string };

export type SeatedBooking = Prisma.BookingGetPayload<{
  select: {
    uid: true;
    id: true;
    attendees: { include: { bookingSeat: true } };
    userId: true;
    references: true;
    startTime: true;
    user: true;
    status: true;
    smsReminderNumber: true;
    endTime: true;
    metadata: true;
    responses: true;
  };
}>;

export type HandleSeatsResultBooking =
  | (Partial<Booking> & {
      appsStatus?: AppsStatus[];
      seatReferenceUid?: string;
      paymentUid?: string;
      message?: string;
      paymentId?: number;
      attendees: Attendee[];
    })
  | null;

export type NewTimeSlotBooking = Prisma.BookingGetPayload<{
  select: {
    id: true;
    uid: true;
    iCalUID: true;
    userId: true;
    references: true;
    attendees: {
      include: {
        bookingSeat: true;
      };
    };
  };
}>;

export type SeatAttendee = Partial<Person>;
