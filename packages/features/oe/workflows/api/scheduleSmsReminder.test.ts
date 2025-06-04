import { vi, describe, it, expect, beforeEach } from "vitest";

import dayjs from "@calcom/dayjs";
import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowActions } from "@calcom/prisma/enums";

import * as twilio from "../lib/reminders/providers/twilioProvider";

vi.mock("@calcom/prisma", () => ({
  default: {
    workflowReminder: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    profile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../lib/reminders/providers/twilioProvider", () => ({
  scheduleSMS: vi.fn(),
  cancelSMS: vi.fn(),
}));

describe("SMS Workflow Reminders", () => {
  const createReminderData = () => {
    const futureDate = dayjs().add(3, "day").toISOString();
    const phoneNumber = "+1234567890";
    const bookingIdentifier = "booking-123";

    return {
      id: 1,
      method: WorkflowMethods.SMS,
      scheduled: false,
      scheduledDate: futureDate,
      workflowStep: {
        workflow: {
          userId: 100,
          teamId: 200,
        },
        action: WorkflowActions.SMS_ATTENDEE,
        reminderBody: "Test reminder for your upcoming event",
        sender: "test_sender",
        template: null,
      },
      booking: {
        uid: bookingIdentifier,
        startTime: new Date(),
        smsReminderNumber: phoneNumber,
        eventType: {
          title: "Team Meeting",
          id: 300,
        },
        attendees: [
          {
            name: "John Doe",
            email: "john@example.com",
            timeZone: "UTC",
          },
        ],
        user: {
          name: "Jane Smith",
          id: 500,
          timeZone: "America/New_York",
        },
      },
      retryCount: 0,
    };
  };

  const reminderTestData = createReminderData();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully schedule SMS reminders", async () => {
    const twilioResponseId = "mock-twilio-sid";
    const reminderList = [reminderTestData];

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue(reminderList);
    vi.mocked(twilio.scheduleSMS).mockImplementationOnce(async () => ({
      sid: twilioResponseId,
    }));

    const dbUpdateTracker = vi.spyOn(prisma.workflowReminder, "update");

    const pendingReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.SMS,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    expect(pendingReminders.length).toEqual(1);

    const processReminder = async (reminderItem: any) => {
      const smsResult = await twilio.scheduleSMS(
        reminderItem.booking.smsReminderNumber,
        reminderItem.workflowStep.reminderBody,
        reminderItem.scheduledDate,
        reminderItem.workflowStep.sender,
        reminderItem.workflowStep.workflow.userId,
        reminderItem.workflowStep.workflow.teamId
      );

      expect(smsResult).toBeDefined();
      expect((smsResult as any).sid).toEqual(twilioResponseId);

      const updatePayload = {
        where: { id: reminderItem.id },
        data: {
          scheduled: true,
          referenceId: (smsResult as any).sid,
        },
      };

      await prisma.workflowReminder.update(updatePayload);
    };

    await Promise.all(pendingReminders.map(processReminder));

    expect(twilio.scheduleSMS).toHaveBeenCalledWith(
      "+1234567890",
      "Test reminder for your upcoming event",
      reminderTestData.scheduledDate,
      "test_sender",
      100,
      200
    );

    expect(dbUpdateTracker).toHaveBeenCalledWith({
      where: { id: reminderTestData.id },
      data: {
        scheduled: true,
        referenceId: twilioResponseId,
      },
    });
  });

  it("should handle scheduling failures", async () => {
    const emptyResponse = { sid: "" };
    const reminderArray = [reminderTestData];

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue(reminderArray);
    vi.mocked(twilio.scheduleSMS).mockImplementationOnce(async () => emptyResponse);

    const dbUpdateTracker = vi.spyOn(prisma.workflowReminder, "update");

    const pendingReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.SMS,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    let currentIndex = 0;
    const totalReminders = pendingReminders.length;

    do {
      const activeReminder = pendingReminders[currentIndex];

      const smsResponse = await twilio.scheduleSMS(
        (activeReminder as any).booking.smsReminderNumber,
        (activeReminder as any).workflowStep.reminderBody,
        activeReminder.scheduledDate,
        (activeReminder as any).workflowStep.sender,
        (activeReminder as any).workflowStep.workflow.userId,
        (activeReminder as any).workflowStep.workflow.teamId
      );

      expect(smsResponse).toBeDefined();

      const newRetryCount = activeReminder.retryCount + 1;

      await prisma.workflowReminder.update({
        where: { id: activeReminder.id },
        data: {
          retryCount: newRetryCount,
        },
      });

      currentIndex++;
    } while (currentIndex < totalReminders);

    expect(dbUpdateTracker).toHaveBeenCalledWith({
      where: { id: reminderTestData.id },
      data: {
        retryCount: reminderTestData.retryCount + 1,
      },
    });
  });

  it("should handle edge cases with no reminders", async () => {
    const noReminders: (typeof reminderTestData)[] = [];

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue(noReminders);

    const pendingReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.SMS,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    const reminderCount = pendingReminders.length;
    expect(reminderCount).toStrictEqual(0);

    expect(twilio.scheduleSMS).not.toHaveBeenCalled();
  });
});
