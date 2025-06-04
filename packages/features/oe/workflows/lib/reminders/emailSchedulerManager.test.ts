import type { MailData } from "@sendgrid/helpers/classes/mail";
import { vi, describe, it, expect, beforeEach } from "vitest";

import logger from "@calcom/lib/logger";
import { WorkflowTemplates, WorkflowActions, TimeUnit, WorkflowTriggerEvents } from "@calcom/prisma/enums";

import type { ScheduleEmailReminderAction } from "../types";
import { scheduleEmailReminder } from "./emailReminderManager";
import type { ScheduleReminderArgs } from "./emailReminderManager";
import { sendSendgridMail } from "./providers/sendgridProvider";
import { getBatchId } from "./providers/sendgridProvider";
import type { BookingInfo } from "./smsReminderManager";

vi.mock("./providers/sendgridProvider", () => ({
  sendSendgridMail: vi.fn().mockResolvedValue({}),
  getBatchId: vi.fn().mockResolvedValue("mock-batch-id"),
}));

vi.mock("@calcom/lib/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    getSubLogger: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("../../../../../../tests/libs/__mocks__/prismaMock", () => {
  return {
    default: {
      workflowReminder: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({
          id: 1,
          attendeeId: null,
          bookingUid: null,
          method: "EMAIL",
          scheduledDate: new Date(),
          referenceId: null,
          scheduled: false,
          workflowStepId: null,
          cancelled: true,
          seatReferenceId: null,
          isMandatoryReminder: null,
          retryCount: 0,
        }),
      },
    },
  };
});

// Example booking info
const bookingInfo: BookingInfo = {
  uid: "example-uid",
  bookerUrl: "https://example.com/booker",
  attendees: [
    {
      name: "John Doe",
      email: "john@example.com",
      timeZone: "UTC",
      language: { locale: "en" },
      firstName: "John",
      lastName: "Doe",
    },
  ],
  organizer: {
    language: { locale: "en" },
    name: "Organizer Name",
    email: "organizer@example.com",
    timeZone: "UTC",
  },
  eventType: {
    title: "Example Event Type",
    slug: "example-event-type",
    id: 1,
  },
  startTime: "2024-01-01T10:00:00.000Z",
  endTime: "2024-01-01T11:00:00.000Z",
  title: "Example Event",
  location: "Online",
  additionalNotes: "Some additional notes",
  responses: null,
  metadata: null,
};

const scheduleArgs: ScheduleReminderArgs & {
  evt: BookingInfo;
  sendTo: MailData["to"];
  action: ScheduleEmailReminderAction;
  emailSubject?: string;
  emailBody?: string;
  hideBranding?: boolean;
  includeCalendarEvent?: boolean;
  isMandatoryReminder?: boolean;
} = {
  evt: bookingInfo,
  triggerEvent: WorkflowTriggerEvents.BEFORE_EVENT,
  timeSpan: {
    time: 1,
    timeUnit: TimeUnit.MINUTE,
  },
  sendTo: "john@example.com",
  action: WorkflowActions.EMAIL_ATTENDEE,
  template: WorkflowTemplates.REMINDER,
  sender: null,
  workflowStepId: undefined,
  seatReferenceUid: undefined,
  attendeeId: undefined,
  emailSubject: "",
  emailBody: "",
  hideBranding: false,
  includeCalendarEvent: true,
  isMandatoryReminder: false,
};

describe("emailReminderManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should schedule an email reminder", async () => {
    await scheduleEmailReminder(scheduleArgs);

    expect(getBatchId).toHaveBeenCalledTimes(1);
  });

  it("should handle errors when scheduling an email reminder", async () => {
    vi.mocked(sendSendgridMail).mockRejectedValue(new Error("Mocked error"));

    try {
      await scheduleEmailReminder(scheduleArgs);
    } catch (error) {
      expect(logger.error).toHaveBeenCalled();
    }
  });
});
