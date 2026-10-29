import { describe, expect, it } from "vitest";
import { headersForBrowser, headersForUpstream } from "./forward-headers";

const IDEMPOTENCY_KEY = "0195f3a0-0000-7000-8000-000000000003";

describe("forwarded headers", () => {
  it("passes every Set-Cookie back and forces private, no-store cache control", () => {
    const upstream = new Response(null, {
      status: 200,
      headers: [
        ["cache-control", "public, max-age=60"],
        ["set-cookie", "sf_access=abc; Path=/; HttpOnly"],
        ["set-cookie", "sf_refresh=def; Path=/api/v1/storefront; HttpOnly"],
      ],
    });

    const browserHeaders = headersForBrowser(upstream);
    const cookies = browserHeaders.getSetCookie();

    expect(cookies).toEqual([
      "sf_access=abc; Path=/; HttpOnly",
      "sf_refresh=def; Path=/api/v1/storefront; HttpOnly",
    ]);
    expect(browserHeaders.get("cache-control")).toBe("private, no-store");
  });

  it("forces private, no-store cache control when upstream omits Cache-Control", () => {
    const upstream = new Response(null, {
      status: 200,
      headers: [["content-type", "application/json"]],
    });

    const browserHeaders = headersForBrowser(upstream);

    expect(browserHeaders.get("cache-control")).toBe("private, no-store");
  });

  it("preserves upstream public Cache-Control when no Set-Cookie is present", () => {
    const upstream = new Response(null, {
      status: 200,
      headers: [["cache-control", "public, max-age=60"]],
    });

    const browserHeaders = headersForBrowser(upstream);

    expect(browserHeaders.get("cache-control")).toBe("public, max-age=60");
  });

  it("sends no browser Origin or Host to the API", () => {
    const incoming = new Headers({
      origin: "https://shop.sites.example.com",
      host: "shop.sites.example.com",
      cookie: "sf_access=abc",
      "idempotency-key": IDEMPOTENCY_KEY,
    });

    const outgoing = headersForUpstream(incoming);

    expect(outgoing.get("origin")).toBeNull();
    expect(outgoing.get("host")).toBeNull();
    expect(outgoing.get("cookie")).toBe("sf_access=abc");
    expect(outgoing.get("idempotency-key")).toBe(IDEMPOTENCY_KEY);
  });

  it("forwards the client address chain the storefront received", () => {
    const incoming = new Headers({ "x-forwarded-for": "203.0.113.7, 198.51.100.2" });

    const outgoing = headersForUpstream(incoming);

    expect(outgoing.get("x-forwarded-for")).toBe("203.0.113.7, 198.51.100.2");
  });

  it("adds no address of its own when the browser sent none", () => {
    expect(headersForUpstream(new Headers()).get("x-forwarded-for")).toBeNull();
  });
});
