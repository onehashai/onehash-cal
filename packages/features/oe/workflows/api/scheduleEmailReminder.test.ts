import { vi, describe, it, expect, beforeEach } from "vitest";

import dayjs from "@calcom/dayjs";
import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowActions } from "@calcom/prisma/enums";

import * as sendgrid from "../lib/reminders/providers/sendgridProvider";

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

vi.mock("../lib/reminders/providers/sendgridProvider", () => ({
  getBatchId: vi.fn(),
  sendSendgridMail: vi.fn(),
  cancelScheduledEmail: vi.fn(),
}));

describe("Email Workflow Reminders", () => {
  const mockWorkflowReminder = {
    id: 1,
    method: WorkflowMethods.EMAIL,
    scheduled: false,
    scheduledDate: dayjs().add(3, "day").toISOString(),
    workflowStep: {
      workflow: {
        userId: 100,
        teamId: 200,
      },
      action: WorkflowActions.EMAIL_ATTENDEE,
      reminderBody: "Test reminder for your upcoming event",
      sender: "test_sender",
      template: null,
      emailSubject: "Event Reminder",
    },
    booking: {
      uid: "booking-123",
      startTime: new Date(),
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
        email: "jane@example.com",
        id: 500,
        timeZone: "America/New_York",
      },
      metadata: {},
    },
    retryCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully schedule email reminders", async () => {
    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue([mockWorkflowReminder]);

    vi.mocked(sendgrid.getBatchId).mockResolvedValue("mock-batch-id");
    vi.mocked(sendgrid.sendSendgridMail).mockResolvedValue({
      messageId: "mock-message-id",
    });

    const updateSpy = vi.spyOn(prisma.workflowReminder, "update");

    const unscheduledReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.EMAIL,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    expect(unscheduledReminders).toHaveLength(1);

    for (const reminder of unscheduledReminders) {
      const batchId = await sendgrid.getBatchId();

      const scheduledEmail = await sendgrid.sendSendgridMail(
        {
          to: (reminder as any).booking.attendees[0].email,
          subject: (reminder as any).workflowStep.emailSubject,
          html: (reminder as any).workflowStep.reminderBody,
          batchId: batchId,
          sendAt: dayjs(reminder.scheduledDate).unix(),
        },
        { sender: (reminder as any).workflowStep.sender },
        {
          ...((reminder as any).booking.eventType?.id && {
            eventTypeId: (reminder as any).booking.eventType.id,
          }),
        }
      );

      expect(scheduledEmail).toBeTruthy();
      expect((scheduledEmail as any).messageId).toBe("mock-message-id");

      await prisma.workflowReminder.update({
        where: { id: reminder.id },
        data: {
          scheduled: true,
          referenceId: batchId,
        },
      });
    }

    expect(sendgrid.sendSendgridMail).toHaveBeenCalledWith(
      {
        to: "john@example.com",
        subject: "Event Reminder",
        html: "Test reminder for your upcoming event",
        batchId: "mock-batch-id",
        sendAt: expect.any(Number),
      },
      { sender: "test_sender" },
      { eventTypeId: 300 }
    );

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: mockWorkflowReminder.id },
      data: {
        scheduled: true,
        referenceId: "mock-batch-id",
      },
    });
  });

  it("should handle scheduling failures", async () => {
    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue([mockWorkflowReminder]);

    vi.mocked(sendgrid.getBatchId).mockResolvedValue("mock-batch-id");
    vi.mocked(sendgrid.sendSendgridMail).mockRejectedValue(new Error("Sending failed"));

    const updateSpy = vi.spyOn(prisma.workflowReminder, "update");

    const unscheduledReminders = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.EMAIL,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    for (const reminder of unscheduledReminders) {
      try {
        await sendgrid.sendSendgridMail(
          {
            to: (reminder as any).booking.attendees[0].email,
            subject: (reminder as any).workflowStep.emailSubject,
            html: (reminder as any).workflowStep.reminderBody,
            batchId: await sendgrid.getBatchId(),
            sendAt: dayjs(reminder.scheduledDate).unix(),
          },
          { sender: (reminder as any).workflowStep.sender },
          {
            ...((reminder as any).booking.eventType?.id && {
              eventTypeId: (reminder as any).booking.eventType.id,
            }),
          }
        );
      } catch (error) {
        // Update with retry count
        await prisma.workflowReminder.update({
          where: { id: reminder.id },
          data: {
            retryCount: reminder.retryCount + 1,
          },
        });
      }
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
        method: WorkflowMethods.EMAIL,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    expect(unscheduledReminders).toHaveLength(0);

    expect(sendgrid.sendSendgridMail).not.toHaveBeenCalled();
  });
});
