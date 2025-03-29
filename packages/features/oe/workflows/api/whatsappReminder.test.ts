import { vi, describe, it, expect } from "vitest";

import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowActions } from "@calcom/prisma/enums";

import * as twilio from "../lib/reminders/providers/twilioProvider";

vi.mock("@calcom/prisma", () => ({
  default: {
    workflowReminder: {
      findMany: vi.fn(), // Explicitly mocking findMany
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/reminders/providers/twilioProvider", () => ({
  generateContentVars: vi.fn(),
  scheduleSMS: vi.fn(),
}));

describe("WhatsApp Workflow Reminders", () => {
  it("should schedule reminders", async () => {
    const mockReminders = [
      {
        id: 1,
        scheduledDate: new Date(),
        workflowStep: {
          workflow: {
            userId: 100,
            teamId: 200,
          },
          sendTo: "+1234567890",
          action: WorkflowActions.WHATSAPP_ATTENDEE,
          template: "reminder_template",
        },
      },
    ];

    (prisma.workflowReminder.findMany as any).mockResolvedValue(mockReminders);
    (twilio.generateContentVars as any).mockReturnValue({});
    (twilio.scheduleSMS as any).mockResolvedValue({ sid: "test-sid" });

    const reminders = await prisma.workflowReminder.findMany({
      where: { method: WorkflowMethods.WHATSAPP },
    });

    expect(reminders).toHaveLength(1);

    const reminder = mockReminders[0];
    const contentVars = twilio.generateContentVars(
      {
        workflowStep: {
          action: reminder.workflowStep.action,
        },
        booking: {
          eventType: null,
          startTime: new Date(),
          user: null,
        },
      },
      "",
      "",
      ""
    );

    const result = await twilio.scheduleSMS(
      reminder.workflowStep.sendTo,
      "",
      reminder.scheduledDate,
      "",
      reminder.workflowStep.workflow.userId,
      reminder.workflowStep.workflow.teamId,
      true
    );

    expect(result).toBeTruthy();
    expect((result as any).sid).toBe("test-sid");
  });
});
