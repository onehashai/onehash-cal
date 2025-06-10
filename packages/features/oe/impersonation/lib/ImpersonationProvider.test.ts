import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";

import { UserPermissionRole } from "@calcom/prisma/enums";

import {
  parseTeamId,
  checkSelfImpersonation,
  checkUserIdentifier,
  checkGlobalPermission,
} from "./ImpersonationProvider";

const mockSessionData: Session = {
  expires: "2021-08-31T15:00:00.000Z",
  hasValidLicense: true,
  user: {
    id: 123,
    username: "test",
    role: UserPermissionRole.USER,
    email: "test@example.com",
  },
  upId: "",
  keycloak_token: undefined,
};

describe("parseTeamId", () => {
  it("returns undefined when teamId parameter is missing", () => {
    const result = parseTeamId(undefined);
    expect(result).toBeUndefined();
  });

  it("converts valid teamId string to numeric value", () => {
    const input = { username: "test", teamId: "123" };
    const result = parseTeamId(input);
    expect(result).toBe(123);
  });

  it("throws error for negative teamId values", () => {
    const input = { username: "test", teamId: "-123" };
    expect(() => parseTeamId(input)).toThrow();
  });

  it("throws error for non-numeric teamId strings", () => {
    const input = { username: "test", teamId: "notanumber" };
    expect(() => parseTeamId(input)).toThrow();
  });
});

describe("checkSelfImpersonation", () => {
  it("prevents impersonation when target matches session username", () => {
    const targetUser = { username: "test" };
    expect(() => checkSelfImpersonation(mockSessionData, targetUser)).toThrow();
  });

  it("prevents impersonation when target matches session email", () => {
    const targetUser = { username: "test@example.com" };
    expect(() => checkSelfImpersonation(mockSessionData, targetUser)).toThrow();
  });

  it("allows impersonation for different user identifiers", () => {
    const targetUser = { username: "other" };
    expect(() => checkSelfImpersonation(mockSessionData, targetUser)).not.toThrow();
  });
});

describe("checkUserIdentifier", () => {
  it("rejects undefined username parameter", () => {
    expect(() => checkUserIdentifier(undefined)).toThrow();
  });

  it("accepts valid username parameter", () => {
    const userInput = { username: "test" };
    expect(() => checkUserIdentifier(userInput)).not.toThrow();
  });
});

describe("checkPermission", () => {
  it("blocks non-admin users when team impersonation disabled", () => {
    process.env.NEXT_PUBLIC_TEAM_IMPERSONATION = "false";
    expect(() => checkGlobalPermission(mockSessionData)).toThrow();
  });

  it("permits admin users when team impersonation disabled", () => {
    const adminSession = {
      ...mockSessionData,
      user: { ...mockSessionData.user, role: UserPermissionRole.ADMIN },
    };
    process.env.NEXT_PUBLIC_TEAM_IMPERSONATION = "false";
    expect(() => checkGlobalPermission(adminSession)).not.toThrow();
  });

  it("permits non-admin users when team impersonation enabled", () => {
    process.env.NEXT_PUBLIC_TEAM_IMPERSONATION = "true";
    expect(() => checkGlobalPermission(mockSessionData)).not.toThrow();
  });
});
