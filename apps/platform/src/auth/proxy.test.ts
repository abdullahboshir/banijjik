import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../../proxy";

describe("proxy", () => {
  it("hands the requested path and query to server components, overwriting what the client sent", () => {
    const request = new NextRequest("http://localhost:3200/tenants?q=acme", {
      headers: { "x-request-path": "/forged" },
    });
    const response = proxy(request);
    expect(response.headers.get("x-middleware-request-x-request-path")).toBe("/tenants?q=acme");
  });

  it("clears the loop-guard marker of the platform app on the sign-in page, and only that one", () => {
    const response = proxy(new NextRequest("http://localhost:3200/sign-in"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("platform_session_renewed=;");
    expect(setCookie).not.toMatch(/(^|[ ,])session_renewed=/);
  });
});
