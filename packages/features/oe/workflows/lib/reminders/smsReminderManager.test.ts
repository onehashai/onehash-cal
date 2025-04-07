import { vi, describe, it, expect, beforeEach } from "vitest";

import logger from "@calcom/lib/logger";
import prisma from "@calcom/prisma";

import { deleteScheduledSMSReminder } from "./smsReminderManager";

vi.mock("@calcom/lib/logger", () => {
  const loggerMock = {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    getSubLogger: vi.fn(() => loggerMock), // Ensures getSubLogger returns itself
  };

  return { default: loggerMock };
});

vi.mock("@calcom/prisma", () => ({
  default: {
    workflowReminder: {
      update: vi.fn().mockResolvedValue({ id: 1, cancelled: true }),
    },
  },
}));

describe("deleteScheduledSMSReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark a scheduled SMS reminder as cancelled", async () => {
    await deleteScheduledSMSReminder(1, "mock-reference-id");

    expect(prisma.workflowReminder.update).toHaveBeenCalledTimes(1);
    expect(prisma.workflowReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { cancelled: true },
    });
  });

  it("should log an error if prisma update fails", async () => {
    vi.mocked(prisma.workflowReminder.update).mockRejectedValue(new Error("Mocked DB error"));

    await deleteScheduledSMSReminder(1, "mock-reference-id");

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error canceling reminder"));
  });

  it("should handle a null referenceId without errors", async () => {
    await deleteScheduledSMSReminder(1, null);

    expect(prisma.workflowReminder.update).toHaveBeenCalledTimes(1);
    expect(prisma.workflowReminder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { cancelled: true },
    });
  });

  it("should not throw an error if prisma.update succeeds", async () => {
    await expect(deleteScheduledSMSReminder(1, "mock-reference-id")).resolves.not.toThrow();
  });
});
