import { describe, expect, it } from "vitest";
import {
  STOREFRONT_CANONICAL_HOST_HEADER,
  STOREFRONT_FORWARDED_HOST_HEADER,
  STOREFRONT_GENERATION_HEADER,
  STOREFRONT_ORGANIZATION_HEADER,
  STOREFRONT_VERSION_HEADER,
  organizationIdFrom,
  requestHeadersFor,
  storefrontResolutionFrom,
} from "./organization-header";

const ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000001";
const VERSION_ID = "0195f3a0-0000-7000-8000-000000000002";

describe("organization header", () => {
  it("overwrites spoofed headers from the trusted host resolution", () => {
    const client = new Headers({
      [STOREFRONT_ORGANIZATION_HEADER]: "0195f3a0-0000-7000-8000-000000000099",
      [STOREFRONT_FORWARDED_HOST_HEADER]: "victim.example.com",
      [STOREFRONT_CANONICAL_HOST_HEADER]: "victim.example.com",
      [STOREFRONT_VERSION_HEADER]: "0195f3a0-0000-7000-8000-000000000099",
      [STOREFRONT_GENERATION_HEADER]: "99",
    });

    const trusted = {
      organizationId: ORGANIZATION_ID,
      hostname: "shop.example.com",
      canonicalHostname: "shop.example.com",
      publishedWebsiteVersionId: VERSION_ID,
      generation: 1,
    };

    const headers = requestHeadersFor(client, trusted);

    expect(organizationIdFrom(headers)).toBe(ORGANIZATION_ID);
    expect(headers.get(STOREFRONT_ORGANIZATION_HEADER)).toBe(ORGANIZATION_ID);
    expect(headers.get(STOREFRONT_FORWARDED_HOST_HEADER)).toBe("shop.example.com");
    expect(headers.get(STOREFRONT_CANONICAL_HOST_HEADER)).toBe("shop.example.com");
    expect(headers.get(STOREFRONT_VERSION_HEADER)).toBe(VERSION_ID);
    expect(headers.get(STOREFRONT_GENERATION_HEADER)).toBe("1");
    expect(storefrontResolutionFrom(headers)).toEqual(trusted);
  });

  it("strips client-supplied resolution headers for an unknown host", () => {
    const client = new Headers({
      [STOREFRONT_ORGANIZATION_HEADER]: ORGANIZATION_ID,
      [STOREFRONT_FORWARDED_HOST_HEADER]: "attacker.example.com",
      [STOREFRONT_CANONICAL_HOST_HEADER]: "attacker.example.com",
      [STOREFRONT_VERSION_HEADER]: VERSION_ID,
      [STOREFRONT_GENERATION_HEADER]: "1",
    });

    const headers = requestHeadersFor(client, undefined);

    expect(organizationIdFrom(headers)).toBeUndefined();
    expect(headers.get(STOREFRONT_ORGANIZATION_HEADER)).toBeNull();
    expect(headers.get(STOREFRONT_FORWARDED_HOST_HEADER)).toBeNull();
    expect(headers.get(STOREFRONT_CANONICAL_HOST_HEADER)).toBeNull();
    expect(headers.get(STOREFRONT_VERSION_HEADER)).toBeNull();
    expect(headers.get(STOREFRONT_GENERATION_HEADER)).toBeNull();
    expect(storefrontResolutionFrom(headers)).toBeUndefined();
  });
});
