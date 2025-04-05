import prisma from "../../../../../../tests/libs/__mocks__/prismaMock";

import { vi, describe, it, expect } from "vitest";

import logger from "@calcom/lib/logger";

import { deleteScheduledEmailReminder } from "./emailReminderManager";

vi.mock("../../../../../../tests/libs/__mocks__/prismaMock", () => ({
  default: {
    workflowReminder: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@calcom/lib/logger", () => {
  const loggerMock = {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    getSubLogger: vi.fn(() => loggerMock), // Fix: return the same mock object
  };

  return {
    default: loggerMock,
  };
});

describe("deleteScheduledEmailReminder", () => {
  it("should log an error if deleting a scheduled email reminder fails", async () => {
    const errorMessage = "Database update failed";
    const error = new Error(errorMessage);

    prisma.workflowReminder.update.mockRejectedValue(error);

    await deleteScheduledEmailReminder(1, "mock-reference-id");

    expect(logger.error).toHaveBeenCalled();
  });
});
