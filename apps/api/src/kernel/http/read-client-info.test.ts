import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { readClientInfo } from "./read-client-info.js";

function requestWith(userAgent: string | undefined, ip: string | undefined): Request {
  // Safe: the function under test reads only `get` and `ip`, so a request with just those is enough.
  return { get: () => userAgent, ip } as unknown as Request;
}

describe("readClientInfo", () => {
  it("reads the user agent and the address of the request", () => {
    const client = readClientInfo(requestWith("test-agent", "203.0.113.5"));

    expect(client).toEqual({ userAgent: "test-agent", ipAddress: "203.0.113.5" });
  });

  it("leaves both values undefined when the transport gives none", () => {
    const client = readClientInfo(requestWith(undefined, undefined));

    expect(client).toEqual({ userAgent: undefined, ipAddress: undefined });
  });
});
