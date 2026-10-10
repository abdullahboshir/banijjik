import { describe, expect, it } from "vitest";
import { sessionGuardTarget } from "./session-guard-target";

describe("sessionGuardTarget", () => {
  it("sends a visitor without a session to the silent renewal page", () => {
    expect(sessionGuardTarget("/acme", false)).toBe("/session?next=%2Facme");
  });

  it("sends a visitor to sign-in with a reason when a renewal just worked but there is still no session", () => {
    expect(sessionGuardTarget("/acme", true)).toBe("/sign-in?next=%2Facme&reason=session");
  });

  it("falls back to the home path for an unsafe requested path in both cases", () => {
    expect(sessionGuardTarget("//evil.com", false)).toBe("/session?next=%2F");
    expect(sessionGuardTarget("//evil.com", true)).toBe("/sign-in?next=%2F&reason=session");
  });
});
