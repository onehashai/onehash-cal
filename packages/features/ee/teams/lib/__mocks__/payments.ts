import { beforeEach, vi, expect } from "vitest";
import { mockReset, mockDeep } from "vitest-mock-extended";

import type * as payments from "@calcom/features/oe/teams/lib/payments";

vi.mock("@calcom/features/oe/teams/lib/payments", () => paymentsMock);

beforeEach(() => {
  mockReset(paymentsMock);
});

const paymentsMock = mockDeep<typeof payments>();

export const paymentsScenarios = {};
export const paymentsExpects = {
  expectQuantitySubscriptionToBeUpdatedForTeam: (teamId: number) => {
    expect(paymentsMock.updateQuantitySubscriptionFromStripe).toHaveBeenCalledWith(teamId);
  },
};

export default paymentsMock;
