import { BillingNotEnabledGuard } from "./billing-not-enabled.guard";

describe("BillingNotEnabledGuard", () => {
  it("should be defined", () => {
    expect(new BillingNotEnabledGuard()).toBeDefined();
  });
});
