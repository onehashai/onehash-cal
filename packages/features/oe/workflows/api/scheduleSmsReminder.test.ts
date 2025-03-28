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
  const mockWorkflowReminder = {
    id: 1,
    method: WorkflowMethods.SMS,
    scheduled: false,
    scheduledDate: dayjs().add(3, "day").toISOString(),
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
      uid: "booking-123",
      startTime: new Date(),
      smsReminderNumber: "+1234567890",
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully schedule SMS reminders", async () => {
    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue([mockWorkflowReminder]);

    vi.mocked(twilio.scheduleSMS).mockResolvedValue({
      sid: "mock-twilio-sid",
    });

    const updateSpy = vi.spyOn(prisma.workflowReminder, "update");

    const unscheduledReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.SMS,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    expect(unscheduledReminders).toHaveLength(1);

    for (const reminder of unscheduledReminders) {
      const scheduledSMS = await twilio.scheduleSMS(
        (reminder as any).booking.smsReminderNumber,
        (reminder as any).workflowStep.reminderBody,
        reminder.scheduledDate,
        (reminder as any).workflowStep.sender,
        (reminder as any).workflowStep.workflow.userId,
        (reminder as any).workflowStep.workflow.teamId
      );

      expect(scheduledSMS).toBeTruthy();
      expect((scheduledSMS as any).sid).toBe("mock-twilio-sid");

      await prisma.workflowReminder.update({
        where: { id: reminder.id },
        data: {
          scheduled: true,
          referenceId: (scheduledSMS as any).sid,
        },
      });
    }

    expect(twilio.scheduleSMS).toHaveBeenCalledWith(
      "+1234567890",
      "Test reminder for your upcoming event",
      mockWorkflowReminder.scheduledDate,
      "test_sender",
      100,
      200
    );

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: mockWorkflowReminder.id },
      data: {
        scheduled: true,
        referenceId: "mock-twilio-sid",
      },
    });
  });

  it("should handle scheduling failures", async () => {
    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue([mockWorkflowReminder]);

    vi.mocked(twilio.scheduleSMS).mockResolvedValue({ sid: "" });

    const updateSpy = vi.spyOn(prisma.workflowReminder, "update");

    const unscheduledReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.SMS,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    for (const reminder of unscheduledReminders) {
      const scheduledSMS = await twilio.scheduleSMS(
        (reminder as any).booking.smsReminderNumber,
        (reminder as any).workflowStep.reminderBody,
        reminder.scheduledDate,
        (reminder as any).workflowStep.sender,
        (reminder as any).workflowStep.workflow.userId,
        (reminder as any).workflowStep.workflow.teamId
      );

      // Verify scheduling failed
      expect(scheduledSMS).toBeTruthy();

      // Update with retry count
      await prisma.workflowReminder.update({
        where: { id: reminder.id },
        data: {
          retryCount: reminder.retryCount + 1,
        },
      });
    }

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: mockWorkflowReminder.id },
      data: {
        retryCount: mockWorkflowReminder.retryCount + 1,
      },
    });
  });

  it("should handle edge cases with no reminders", async () => {
    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue([]);

    const unscheduledReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.SMS,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    expect(unscheduledReminders).toHaveLength(0);

    expect(twilio.scheduleSMS).not.toHaveBeenCalled();
  });
});
