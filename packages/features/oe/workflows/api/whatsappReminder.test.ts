import { vi, describe, it, expect } from "vitest";

import prisma from "@calcom/prisma";
import { WorkflowMethods, WorkflowActions } from "@calcom/prisma/enums";

import * as twilio from "../lib/reminders/providers/twilioProvider";

vi.mock("@calcom/prisma", () => ({
  default: {
    workflowReminder: {
      findMany: vi.fn(),
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
    const reminderDataSet = (() => {
      const phoneContact = "+1234567890";
      const templateName = "reminder_template";

      return [
        {
          id: 1,
          scheduledDate: new Date(),
          workflowStep: {
            workflow: {
              userId: 100,
              teamId: 200,
            },
            sendTo: phoneContact,
            action: WorkflowActions.WHATSAPP_ATTENDEE,
            template: templateName,
          },
        },
      ];
    })();

    const expectedSid = "test-sid";
    const emptyContentVariables = {};

    vi.mocked(prisma.workflowReminder.findMany).mockResolvedValue(reminderDataSet);

    vi.mocked(twilio.generateContentVars).mockImplementationOnce(() => emptyContentVariables);

    vi.mocked(twilio.scheduleSMS).mockImplementationOnce(async () => ({ sid: expectedSid }));

    const queryParams = {
      where: { method: WorkflowMethods.WHATSAPP },
    };

    const fetchedReminders = await prisma.workflowReminder.findMany(queryParams);

    expect(fetchedReminders.length).toEqual(1);

    const [firstReminder] = reminderDataSet;

    const bookingContext = {
      workflowStep: {
        action: firstReminder.workflowStep.action,
      },
      booking: {
        eventType: null,
        startTime: new Date(),
        user: null,
      },
    };

    const emptyStringParam = "";

    const generatedVars = twilio.generateContentVars(
      bookingContext,
      emptyStringParam,
      emptyStringParam,
      emptyStringParam
    );

    const scheduleParams = [
      firstReminder.workflowStep.sendTo,
      emptyStringParam,
      firstReminder.scheduledDate,
      emptyStringParam,
      firstReminder.workflowStep.workflow.userId,
      firstReminder.workflowStep.workflow.teamId,
      true,
    ] as const;

    const schedulingResult = await twilio.scheduleSMS(...scheduleParams);

    expect(schedulingResult).toBeDefined();
    expect((schedulingResult as any).sid).toEqual(expectedSid);
  });
});
