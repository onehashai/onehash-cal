import { beforeEach, vi, expect } from "vitest";
import { mockReset, mockDeep } from "vitest-mock-extended";

import type * as payments from "@calcom/features/oe/teams/lib/payments";

vi.mock("@calcom/features/oe/teams/lib/payments", () => mockedPaymentService);

beforeEach(() => {
  mockReset(mockedPaymentService);
});

const mockedPaymentService = mockDeep<typeof payments>();

export const paymentsScenarios = {};
export const paymentsExpects = {
  expectQuantitySubscriptionToBeUpdatedForTeam: (organizationId: number) => {
    expect(mockedPaymentService.updateQuantitySubscriptionFromStripe).toHaveBeenCalledWith(organizationId);
  },
};

export default mockedPaymentService;
