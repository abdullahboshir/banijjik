import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveStorefrontHost = vi.hoisted(() => vi.fn());

vi.mock("./src/host/storefront-host", () => ({ resolveStorefrontHost }));

import { proxy } from "./proxy";

function requestTo(url: string): NextRequest {
  const parsed = new URL(url);
  return new NextRequest(url, { headers: { host: parsed.host } });
}

describe("storefront proxy host resolution", () => {
  beforeEach(() => {
    resolveStorefrontHost.mockReset();
  });

  it("answers 503 without caching when the authoritative host lookup fails", async () => {
    resolveStorefrontHost.mockRejectedValue(new Error("API unavailable"));

    const response = await proxy(requestTo("https://shop.example.com/"));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("1");
    await expect(response.json()).resolves.toEqual({
      error: { code: "RETRY_LATER", messageKey: "errors.retry_later" },
    });
  });

  it("lets an unknown host continue so the page can answer not-found", async () => {
    resolveStorefrontHost.mockResolvedValue(undefined);

    const response = await proxy(requestTo("https://unknown.example.com/about"));

    expect(response.status).not.toBe(503);
    expect(resolveStorefrontHost).toHaveBeenCalledTimes(1);
    expect(resolveStorefrontHost).toHaveBeenCalledWith("unknown.example.com");
  });
});
