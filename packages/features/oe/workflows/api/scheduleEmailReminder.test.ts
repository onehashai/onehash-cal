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
  const reminderFixture = (() => {
    const baseDate = dayjs().add(3, "day").toISOString();
    const bookingUid = "booking-123";

    return {
      id: 1,
      method: WorkflowMethods.EMAIL,
      scheduled: false,
      scheduledDate: baseDate,
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
        uid: bookingUid,
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
  })();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully schedule email reminders", async () => {
    const expectedBatchIdentifier = "mock-batch-id";
    const expectedMessageIdentifier = "mock-message-id";

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValueOnce([reminderFixture]);
    vi.mocked(sendgrid.getBatchId).mockResolvedValueOnce(expectedBatchIdentifier);
    vi.mocked(sendgrid.sendSendgridMail).mockResolvedValueOnce({
      messageId: expectedMessageIdentifier,
    });

    const databaseUpdateSpy = vi.spyOn(prisma.workflowReminder, "update");

    const queryResults = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.EMAIL,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    expect(queryResults.length).toEqual(1);

    let reminderIndex = 0;
    while (reminderIndex < queryResults.length) {
      const currentReminder = queryResults[reminderIndex];
      const retrievedBatchId = await sendgrid.getBatchId();

      const emailPayload = {
        to: (currentReminder as any).booking.attendees[0].email,
        subject: (currentReminder as any).workflowStep.emailSubject,
        html: (currentReminder as any).workflowStep.reminderBody,
        batchId: retrievedBatchId,
        sendAt: dayjs(currentReminder.scheduledDate).unix(),
      };

      const senderConfig = {
        sender: (currentReminder as any).workflowStep.sender,
      };

      const metadataConfig = {};
      if ((currentReminder as any).booking.eventType?.id) {
        Object.assign(metadataConfig, {
          eventTypeId: (currentReminder as any).booking.eventType.id,
        });
      }

      const emailResponse = await sendgrid.sendSendgridMail(emailPayload, senderConfig, metadataConfig);

      expect(emailResponse).toBeDefined();
      expect((emailResponse as any).messageId).toEqual(expectedMessageIdentifier);

      await prisma.workflowReminder.update({
        where: { id: currentReminder.id },
        data: {
          scheduled: true,
          referenceId: retrievedBatchId,
        },
      });

      reminderIndex++;
    }

    expect(sendgrid.sendSendgridMail).toHaveBeenCalledWith(
      {
        to: "john@example.com",
        subject: "Event Reminder",
        html: "Test reminder for your upcoming event",
        batchId: expectedBatchIdentifier,
        sendAt: expect.any(Number),
      },
      { sender: "test_sender" },
      { eventTypeId: 300 }
    );

    expect(databaseUpdateSpy).toHaveBeenCalledWith({
      where: { id: reminderFixture.id },
      data: {
        scheduled: true,
        referenceId: expectedBatchIdentifier,
      },
    });
  });

  it("should handle scheduling failures", async () => {
    const failureMessage = "Sending failed";
    const batchIdentifier = "mock-batch-id";

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValueOnce([reminderFixture]);
    vi.mocked(sendgrid.getBatchId).mockResolvedValueOnce(batchIdentifier);
    vi.mocked(sendgrid.sendSendgridMail).mockRejectedValueOnce(new Error(failureMessage));

    const databaseUpdateSpy = vi.spyOn(prisma.workflowReminder, "update");

    const queryResults = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.EMAIL,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    const reminderIterator = queryResults[Symbol.iterator]();
    let currentIteration = reminderIterator.next();

    while (!currentIteration.done) {
      const currentReminder = currentIteration.value;
      const batchIdForSending = await sendgrid.getBatchId();

      const sendingParameters = {
        to: (currentReminder as any).booking.attendees[0].email,
        subject: (currentReminder as any).workflowStep.emailSubject,
        html: (currentReminder as any).workflowStep.reminderBody,
        batchId: batchIdForSending,
        sendAt: dayjs(currentReminder.scheduledDate).unix(),
      };

      const senderInfo = {
        sender: (currentReminder as any).workflowStep.sender,
      };

      const eventMetadata = (currentReminder as any).booking.eventType?.id
        ? { eventTypeId: (currentReminder as any).booking.eventType.id }
        : {};

      try {
        await sendgrid.sendSendgridMail(sendingParameters, senderInfo, eventMetadata);
      } catch (errorInstance) {
        const updatedRetryCount = currentReminder.retryCount + 1;

        await prisma.workflowReminder.update({
          where: { id: currentReminder.id },
          data: {
            retryCount: updatedRetryCount,
          },
        });
      }

      currentIteration = reminderIterator.next();
    }

    expect(databaseUpdateSpy).toHaveBeenCalledWith({
      where: { id: reminderFixture.id },
      data: {
        retryCount: reminderFixture.retryCount + 1,
      },
    });
  });

  it("should handle edge cases with no reminders", async () => {
    const emptyResultSet: any[] = [];

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValueOnce(emptyResultSet);

    const queryResults = await prisma.workflowReminder.findMany({
      where: {
        method: WorkflowMethods.EMAIL,
        scheduled: false,
        scheduledDate: {
          lte: dayjs().add(7, "day").toISOString(),
        },
        OR: [{ cancelled: null }, { cancelled: false }],
      },
    });

    const resultCount = queryResults.length;
    expect(resultCount).toBe(0);

    expect(sendgrid.sendSendgridMail).not.toHaveBeenCalled();
  });
});
