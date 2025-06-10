import { vi, describe, it, expect, beforeEach } from "vitest";

import { TimeFormat } from "@calcom/lib/timeFormat";
import { TimeUnit } from "@calcom/prisma/enums";

import * as twilio from "./providers/twilioProvider";
import { scheduleWhatsappReminder } from "./whatsappReminderManager";

vi.mock("@calcom/prisma", () => ({
  default: {
    workflowReminder: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

vi.mock("./providers/twilioProvider", () => ({
  sendSMS: vi.fn().mockResolvedValue(true),
  scheduleSMS: vi.fn().mockResolvedValue({ sid: "mock-sid" }),
  generateContentVars: vi.fn().mockReturnValue({}),
}));

describe("scheduleWhatsappReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // reset mocks before each test
  });

  const evt = {
    uid: "123",
    bookerUrl: "https://example.com/booker",
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    title: "Test Event",
    organizer: {
      name: "Organizer Name",
      email: "organizer@example.com",
      timeZone: "UTC",
      language: { locale: "en" },
      timeFormat: TimeFormat.TWELVE_HOUR,
    },
    attendees: [
      {
        name: "John Doe",
        email: "johndoe@example.com",
        timeZone: "UTC",
        language: { locale: "en" },
      },
    ],
    eventType: { title: "Meeting" },
  };

  it("should successfully send a WhatsApp reminder", async () => {
    await scheduleWhatsappReminder({
      evt,
      reminderPhone: "1234567890",
      triggerEvent: "NEW_EVENT",
      action: "WHATSAPP_ATTENDEE",
      timeSpan: { time: 10, timeUnit: TimeUnit.MINUTE },
      message: "Reminder",
      template: "REMINDER",
      userId: 1,
      teamId: 1,
    });

    expect(twilio.sendSMS).toHaveBeenCalledTimes(1);
  });

  it("should send WhatsApp message for new event", async () => {
    await scheduleWhatsappReminder({
      evt,
      reminderPhone: "1234567890",
      triggerEvent: "NEW_EVENT",
      action: "WHATSAPP_ATTENDEE",
      timeSpan: { time: 10, timeUnit: TimeUnit.MINUTE },
      message: "Reminder",
      template: "REMINDER",
      userId: 1,
      teamId: 1,
    });

    expect(twilio.sendSMS).toHaveBeenCalledTimes(1);
  });
  it("should not schedule WhatsApp message if scheduled date is too far in the future", async () => {
    await scheduleWhatsappReminder({
      evt,
      reminderPhone: "1234567890",
      triggerEvent: "BEFORE_EVENT",
      action: "WHATSAPP_ATTENDEE",
      timeSpan: { time: 30, timeUnit: TimeUnit.MINUTE },
      message: "Reminder",
      template: "REMINDER",
      userId: 1,
      teamId: 1,
    });

    expect(twilio.scheduleSMS).not.toHaveBeenCalled();
  });
  it("should not throw an error when scheduling a WhatsApp reminder", async () => {
    await expect(
      scheduleWhatsappReminder({
        evt,
        reminderPhone: "1234567890",
        triggerEvent: "NEW_EVENT",
        action: "WHATSAPP_ATTENDEE",
        timeSpan: { time: 10, timeUnit: TimeUnit.MINUTE },
        message: "Reminder",
        template: "REMINDER",
        userId: 1,
        teamId: 1,
      })
    ).resolves.not.toThrow();
  });
});
