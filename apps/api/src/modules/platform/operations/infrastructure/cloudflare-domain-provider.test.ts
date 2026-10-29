import { describe, expect, it, vi } from "vitest";
import {
  CloudflareDomainProvider,
  createDomainProvider,
  DisabledDomainProvider,
} from "./cloudflare-domain-provider.js";

const CONFIG = {
  driver: "cloudflare" as const,
  apiToken: "test-cloudflare-token-value",
  zoneId: "a".repeat(32),
  fallbackOrigin: "tenants.example.net",
  apiBaseUrl: "https://api.cloudflare.com/client/v4",
};

describe("DisabledDomainProvider", () => {
  it("never returns ACTIVE from inspect", async () => {
    const inspect = await new DisabledDomainProvider().inspect("shop.example.com");
    expect(inspect.hostnameActive).toBe(false);
    expect(inspect.certificateActive).toBe(false);
    expect(inspect.dnsTargetsService).toBe(false);
    await expect(
      new DisabledDomainProvider().ensure({ hostname: "shop.example.com", operationKey: "k" }),
    ).rejects.toThrow("domain_provider_unavailable");
  });

  it("createDomainProvider uses disabled when credentials are omitted", () => {
    expect(createDomainProvider({ driver: "disabled" })).toBeInstanceOf(DisabledDomainProvider);
  });
});

describe("CloudflareDomainProvider", () => {
  it("maps public DNS records and a safe diagnostic key without logging the token", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).not.toContain("test-cloudflare-token-value");
      expect(JSON.stringify(init?.headers)).toContain("Bearer ");
      return new Response(
        JSON.stringify({
          success: true,
          result: [
            {
              id: "cf-1",
              status: "pending",
              ownership_verification: {
                type: "txt",
                name: "_cf-custom-hostname.shop.example.com",
                value: "token-value",
              },
              ssl: {
                status: "pending_validation",
                validation_records: [{ txt_name: "_acme-challenge.shop", txt_value: "proof" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const provider = new CloudflareDomainProvider(CONFIG, fetchImpl, async () => []);
    const inspect = await provider.inspect("shop.example.com");
    expect(inspect.hostnameActive).toBe(false);
    expect(inspect.certificateActive).toBe(false);
    expect(inspect.diagnosticKey).toBe("pending_validation");
    expect(inspect.ownershipRecords[0]).toEqual({
      type: "TXT",
      name: "_cf-custom-hostname.shop.example.com",
      value: "token-value",
    });
  });
});
