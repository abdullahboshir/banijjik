import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { GET } from "./route";

function request(input: {
  readonly search?: string;
  readonly host?: string;
  readonly referer?: string;
  readonly forwardedHost?: string;
  readonly forwardedProto?: string;
}): NextRequest {
  const url = new URL(`https://internal.local/language${input.search ?? "?to=en"}`);
  const headers = new Headers();
  if (input.host) headers.set("host", input.host);
  if (input.referer) headers.set("referer", input.referer);
  if (input.forwardedHost) headers.set("x-forwarded-host", input.forwardedHost);
  if (input.forwardedProto) headers.set("x-forwarded-proto", input.forwardedProto);
  return new NextRequest(url, { headers });
}

describe("GET /language", () => {
  it("keeps an external Referer redirect on the request host", async () => {
    const response = GET(
      request({ host: "salon.localhost", referer: "https://evil.example/phish" }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://salon.localhost/");
  });

  it("ignores a mismatched forwarded host and protocol", () => {
    const response = GET(
      request({ host: "salon.localhost", forwardedHost: "evil.example", forwardedProto: "http" }),
    );
    expect(response.headers.get("location")).toBe("https://salon.localhost/");
  });

  it("preserves the same-origin Referer path and query", () => {
    const response = GET(
      request({
        host: "salon.localhost",
        referer: "https://salon.localhost/offerings?kind=SERVICE",
      }),
    );
    expect(response.headers.get("location")).toBe("https://salon.localhost/offerings?kind=SERVICE");
  });

  it("falls back to the root for a malformed Referer", () => {
    const response = GET(request({ host: "salon.localhost", referer: "http://[invalid" }));
    expect(response.headers.get("location")).toBe("https://salon.localhost/");
  });

  it("rejects an external next path and still sets the requested locale cookie", () => {
    const response = GET(
      request({ host: "salon.localhost", search: "?to=en&next=https%3A%2F%2Fevil.example" }),
    );
    expect(response.headers.get("location")).toBe("https://salon.localhost/");
    const cookie = response.cookies.get("locale");
    expect(cookie?.value).toBe("en");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBe(365 * 24 * 60 * 60);
  });
});
