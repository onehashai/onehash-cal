import { z } from "zod";

export const SystemField = z.enum([
  "name",
  "email",
  "location",
  "title",
  "notes",
  "guests",
  "rescheduleReason",
  // "smsReminderNumber",
  "phone",
  "attendeePhoneNumber",
]);

export const SMS_REMINDER_NUMBER_FIELD = "phone";

export const TITLE_FIELD = "title";
