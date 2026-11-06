import type { PublicQuoteRequest } from "@banijjik/contracts/website";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callStorefront } from "../api/client-api";
import { requestQuote } from "./checkout-api";

const ORGANIZATION_ID = "0190a000-0000-7000-8000-000000000001";
const QUOTE_BODY = {
  locationId: "0190a000-0000-7000-8000-000000000002",
  selections: [],
  fulfillment: { method: "PICKUP" },
} as unknown as PublicQuoteRequest;

const QUOTE_OK = { data: { quoteId: "quote-1" } };
const SESSION_OK = { data: { guestSessionId: "guest-1" } };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, { error: { code, messageKey: `errors.${code.toLowerCase()}` } });
}

function stubFetch(...answers: Response[]) {
  const mockFetch = vi.fn();
  for (const answer of answers) mockFetch.mockResolvedValueOnce(answer);
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

function calledPaths(mockFetch: ReturnType<typeof vi.fn>): string[] {
  return mockFetch.mock.calls.map((call) => String(call[0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callStorefront error code", () => {
  it("reads error.code into errorCode on a failed call and leaves it undefined on success", async () => {
    stubFetch(errorResponse(409, "CHECKOUT_PRICE_CHANGED"), jsonResponse(200, { data: {} }));

    const failed = await callStorefront("POST", "/x");
    const succeeded = await callStorefront("POST", "/x");

    expect(failed.errorCode).toBe("CHECKOUT_PRICE_CHANGED");
    expect(succeeded.errorCode).toBeUndefined();
  });

  it("reads error.details.ruleKey into ruleKey on a business rule error", async () => {
    stubFetch(
      jsonResponse(422, {
        error: {
          code: "BUSINESS_RULE",
          messageKey: "errors.delivery_zone_unavailable",
          details: { ruleKey: "DELIVERY_ZONE_UNAVAILABLE" },
        },
      }),
    );

    const failed = await callStorefront("POST", "/quote");

    expect(failed.errorCode).toBe("BUSINESS_RULE");
    expect(failed.ruleKey).toBe("DELIVERY_ZONE_UNAVAILABLE");
  });
});

describe("requestQuote guest session bootstrap", () => {
  it("quotes once and creates no session when the quote succeeds", async () => {
    const mockFetch = stubFetch(jsonResponse(200, QUOTE_OK));

    const result = await requestQuote(ORGANIZATION_ID, QUOTE_BODY);

    expect(result.ok).toBe(true);
    expect(calledPaths(mockFetch)).toHaveLength(1);
    expect(calledPaths(mockFetch)[0]).toContain("/quotes");
  });

  it.each(["UNAUTHENTICATED", "WEBSITE_GUEST_SESSION_EXPIRED"])(
    "creates one guest session and quotes once more after a 401 %s",
    async (code) => {
      const mockFetch = stubFetch(
        errorResponse(401, code),
        jsonResponse(201, SESSION_OK),
        jsonResponse(200, QUOTE_OK),
      );

      const result = await requestQuote(ORGANIZATION_ID, QUOTE_BODY);

      expect(result.ok).toBe(true);
      const paths = calledPaths(mockFetch);
      expect(paths).toHaveLength(3);
      expect(paths[1]).toContain("/guest-session");
      expect(paths[2]).toContain("/quotes");
    },
  );

  it("returns the session 403 WEBSITE_GUEST_CHECKOUT_DISABLED and does not quote again", async () => {
    const mockFetch = stubFetch(
      errorResponse(401, "UNAUTHENTICATED"),
      errorResponse(403, "WEBSITE_GUEST_CHECKOUT_DISABLED"),
    );

    const result = await requestQuote(ORGANIZATION_ID, QUOTE_BODY);

    expect(result.status).toBe(403);
    expect(result.errorCode).toBe("WEBSITE_GUEST_CHECKOUT_DISABLED");
    expect(calledPaths(mockFetch)).toHaveLength(2);
  });

  it("returns the session 429 RATE_LIMITED and does not quote again", async () => {
    const mockFetch = stubFetch(
      errorResponse(401, "UNAUTHENTICATED"),
      errorResponse(429, "RATE_LIMITED"),
    );

    const result = await requestQuote(ORGANIZATION_ID, QUOTE_BODY);

    expect(result.status).toBe(429);
    expect(result.errorCode).toBe("RATE_LIMITED");
    expect(calledPaths(mockFetch)).toHaveLength(2);
  });

  it("returns a second 401 as is after exactly three calls", async () => {
    const mockFetch = stubFetch(
      errorResponse(401, "UNAUTHENTICATED"),
      jsonResponse(201, SESSION_OK),
      errorResponse(401, "UNAUTHENTICATED"),
    );

    const result = await requestQuote(ORGANIZATION_ID, QUOTE_BODY);

    expect(result.status).toBe(401);
    expect(calledPaths(mockFetch)).toHaveLength(3);
  });

  it.each([
    [403, "FORBIDDEN"],
    [429, "RATE_LIMITED"],
    [400, "VALIDATION_FAILED"],
  ])("creates no session for a %i %s quote answer", async (status, code) => {
    const mockFetch = stubFetch(errorResponse(status, code));

    const result = await requestQuote(ORGANIZATION_ID, QUOTE_BODY);

    expect(result.status).toBe(status);
    expect(calledPaths(mockFetch)).toHaveLength(1);
  });
});
