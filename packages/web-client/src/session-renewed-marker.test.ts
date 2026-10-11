import { describe, expect, it } from "vitest";
import { buildSessionRenewedCookie } from "./session-renewed-marker.js";

describe("buildSessionRenewedCookie", () => {
  it("names the marker with the cookie name it is given, so two apps on one host never share it", () => {
    expect(buildSessionRenewedCookie("session_renewed")).toMatch(/^session_renewed=1;/);
    expect(buildSessionRenewedCookie("platform_session_renewed")).toMatch(
      /^platform_session_renewed=1;/,
    );
  });

  it("lives for seconds only and holds no secret", () => {
    expect(buildSessionRenewedCookie("m")).toBe("m=1; Max-Age=15; SameSite=Lax; Path=/");
  });
});
