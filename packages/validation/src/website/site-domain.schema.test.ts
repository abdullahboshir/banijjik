import { describe, expect, it } from "vitest";
import {
  createSiteDomainRequestSchema,
  removeSiteDomainQuerySchema,
  selectCanonicalSiteDomainRequestSchema,
  siteDomainIdParamsSchema,
  siteDomainListQuerySchema,
  siteDomainListResponseSchema,
  siteDomainResponseSchema,
  verifySiteDomainRequestSchema,
} from "./site-domain.schema.js";

const SITE_DOMAIN_ID = "01926b48-1234-7abc-8def-0123456789aa";

function siteDomainResponse() {
  return {
    siteDomainId: SITE_DOMAIN_ID,
    hostname: "shop.example.com",
    status: "VERIFYING",
    version: 1,
    ownershipRecords: [{ type: "TXT", name: "_verify", value: "proof-token" }],
    certificateRecords: [{ type: "CNAME", name: "shop", value: "tenant.example.net" }],
    diagnosticKey: null,
    isCanonical: false,
  };
}

describe("site domain schemas", () => {
  it("accepts the public response with a computed canonical flag", () => {
    expect(siteDomainResponseSchema.parse(siteDomainResponse())).toEqual(siteDomainResponse());
  });

  it("rejects infrastructure fields and missing computed canonical state", () => {
    expect(
      siteDomainResponseSchema.safeParse({ ...siteDomainResponse(), _id: "mongo-id" }).success,
    ).toBe(false);
    const { isCanonical, ...withoutCanonical } = siteDomainResponse();
    expect(isCanonical).toBe(false);
    expect(siteDomainResponseSchema.safeParse(withoutCanonical).success).toBe(false);
  });

  it("accepts a safe diagnostic key and rejects free-form provider details", () => {
    expect(
      siteDomainResponseSchema.safeParse({
        ...siteDomainResponse(),
        diagnosticKey: "verification_pending",
      }).success,
    ).toBe(true);
    expect(
      siteDomainResponseSchema.safeParse({
        ...siteDomainResponse(),
        diagnosticKey: "Authorization: Bearer secret",
      }).success,
    ).toBe(false);
  });

  it("bounds domain lists and uses the shared pagination defaults", () => {
    expect(
      siteDomainListResponseSchema.parse({
        items: [siteDomainResponse()],
        total: 1,
        page: 1,
        limit: 20,
      }).items,
    ).toHaveLength(1);
    expect(siteDomainListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(siteDomainListQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("accepts only the hostname when requesting a domain", () => {
    expect(createSiteDomainRequestSchema.parse({ hostname: " shop.example.com " })).toEqual({
      hostname: "shop.example.com",
    });
    expect(
      createSiteDomainRequestSchema.safeParse({
        hostname: "shop.example.com",
        organizationId: SITE_DOMAIN_ID,
      }).success,
    ).toBe(false);
  });

  it("validates domain identifiers and versioned mutations", () => {
    expect(siteDomainIdParamsSchema.parse({ siteDomainId: SITE_DOMAIN_ID }).siteDomainId).toBe(
      SITE_DOMAIN_ID,
    );
    expect(verifySiteDomainRequestSchema.safeParse({ version: 1 }).success).toBe(true);
    expect(verifySiteDomainRequestSchema.safeParse({ version: 0 }).success).toBe(false);
    expect(removeSiteDomainQuerySchema.parse({ version: "2" })).toEqual({ version: 2 });
    expect(
      selectCanonicalSiteDomainRequestSchema.safeParse({
        version: 1,
        expectedSiteVersion: 0,
        isCanonical: true,
      }).success,
    ).toBe(true);
    expect(
      selectCanonicalSiteDomainRequestSchema.safeParse({
        version: 1,
        expectedSiteVersion: 0,
        isCanonical: false,
      }).success,
    ).toBe(false);
  });
});
