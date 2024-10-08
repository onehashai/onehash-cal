import { beforeEach, vi } from "vitest";
import { mockReset, mockDeep } from "vitest-mock-extended";

import type * as reminderScheduler from "@calcom/features/oe/workflows/lib/reminders/reminderScheduler";

vi.mock("@calcom/features/oe/workflows/lib/reminders/reminderScheduler", () => reminderSchedulerMock);

beforeEach(() => {
  mockReset(reminderSchedulerMock);
});

const reminderSchedulerMock = mockDeep<typeof reminderScheduler>();
export default reminderSchedulerMock;
