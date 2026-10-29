import { SITE_DOMAIN_STATUS } from "@banijjik/contracts/website";
import {
  asId,
  type OrganizationId,
  type SiteDomainId,
  type SiteId,
  type UserId,
  type WebsiteVersionId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { StorefrontHostReader } from "./application/storefront-host-reader.js";
import { Site } from "./domain/site.entity.js";
import { SiteDomain } from "./domain/site-domain.entity.js";
import { permissivePolicy, siteDesign } from "../../../test-support/site-fixtures.js";

const ORGANIZATION_ID = asId<OrganizationId>("0195f3a0-0000-7000-8000-000000000001");
const SITE_ID = asId<SiteId>("0195f3a0-0000-7000-8000-000000000002");
const SITE_DOMAIN_ID = asId<SiteDomainId>("0195f3a0-0000-7000-8000-000000000003");
const CANONICAL_SITE_DOMAIN_ID = asId<SiteDomainId>("0195f3a0-0000-7000-8000-000000000004");
const WEBSITE_VERSION_ID = asId<WebsiteVersionId>("0195f3a0-0000-7000-8000-000000000005");
const USER_ID = asId<UserId>("0195f3a0-0000-7000-8000-000000000006");
const CREATED_AT = new Date("2026-10-29T00:00:00.000Z");

function aSite(canonicalSiteDomainId: SiteDomainId | null = CANONICAL_SITE_DOMAIN_ID): Site {
  return Site.rehydrate({
    siteId: SITE_ID,
    organizationId: ORGANIZATION_ID,
    draftDesign: siteDesign(),
    editPolicy: permissivePolicy(),
    sourceTemplateKey: "retail-starter",
    sourceTemplateRevision: 1,
    publishedWebsiteVersionId: WEBSITE_VERSION_ID,
    nextRevision: 2,
    hasPublishedOnce: true,
    canonicalSiteDomainId,
    version: 2,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    createdByUserId: USER_ID,
    updatedByUserId: USER_ID,
  });
}

function aDomain(input: {
  readonly siteDomainId: SiteDomainId;
  readonly hostname: string;
  readonly status: (typeof SITE_DOMAIN_STATUS)[keyof typeof SITE_DOMAIN_STATUS];
  readonly generation?: number;
}): SiteDomain {
  return SiteDomain.rehydrate({
    siteDomainId: input.siteDomainId,
    organizationId: ORGANIZATION_ID,
    siteId: SITE_ID,
    hostname: input.hostname,
    status: input.status,
    providerHostnameId: "provider-host-id",
    operationGeneration: input.generation ?? 3,
    nextAttemptAt: CREATED_AT,
    lastVerifiedAt: CREATED_AT,
    ownershipRecords: [],
    certificateRecords: [],
    safeDiagnosticKey: null,
    version: 2,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    createdByUserId: USER_ID,
    updatedByUserId: USER_ID,
  });
}

describe("storefront host reader", () => {
  it("does not route a custom host while DNS or TLS verification is pending", async () => {
    const pendingDomain = aDomain({
      siteDomainId: SITE_DOMAIN_ID,
      hostname: "shop.example.com",
      status: SITE_DOMAIN_STATUS.VERIFYING,
    });
    const reader = new StorefrontHostReader({
      sites: siteRepository(async () => aSite()),
      domains: {
        findByHostname: async () => pendingDomain,
        findById: async () => undefined,
      },
    });

    await expect(
      reader.resolve({
        hostname: "shop.example.com",
        freeHostname: "shop.sites.example.com",
        organizationId: ORGANIZATION_ID,
        claim: {
          organizationId: ORGANIZATION_ID,
          hostname: "shop.example.com",
          domainGeneration: 3,
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("routes only an active generation and uses the selected active canonical host", async () => {
    const requestDomain = aDomain({
      siteDomainId: SITE_DOMAIN_ID,
      hostname: "shop.example.com",
      status: SITE_DOMAIN_STATUS.ACTIVE,
    });
    const canonicalDomain = aDomain({
      siteDomainId: CANONICAL_SITE_DOMAIN_ID,
      hostname: "www.example.com",
      status: SITE_DOMAIN_STATUS.ACTIVE,
    });
    const reader = new StorefrontHostReader({
      sites: siteRepository(async () => aSite()),
      domains: {
        findByHostname: async () => requestDomain,
        findById: async (siteDomainId) =>
          siteDomainId === CANONICAL_SITE_DOMAIN_ID ? canonicalDomain : undefined,
      },
    });

    await expect(
      reader.resolve({
        hostname: "shop.example.com",
        freeHostname: "shop.sites.example.com",
        organizationId: ORGANIZATION_ID,
        claim: {
          organizationId: ORGANIZATION_ID,
          hostname: "shop.example.com",
          domainGeneration: 3,
        },
      }),
    ).resolves.toEqual({
      organizationId: ORGANIZATION_ID,
      generation: 3,
      canonicalHostname: "www.example.com",
      publishedWebsiteVersionId: WEBSITE_VERSION_ID,
    });
  });

  it("falls back to the exact free subdomain when the selected domain is no longer active", async () => {
    const reader = new StorefrontHostReader({
      sites: siteRepository(async () => aSite()),
      domains: {
        findByHostname: async () => undefined,
        findById: async () =>
          aDomain({
            siteDomainId: CANONICAL_SITE_DOMAIN_ID,
            hostname: "www.example.com",
            status: SITE_DOMAIN_STATUS.SUSPENDED,
          }),
      },
    });

    await expect(
      reader.resolve({
        hostname: "shop.sites.example.com",
        freeHostname: "shop.sites.example.com",
        organizationId: ORGANIZATION_ID,
      }),
    ).resolves.toMatchObject({ canonicalHostname: "shop.sites.example.com" });
  });

  it("propagates tenant repository failures", async () => {
    const reader = new StorefrontHostReader({
      sites: siteRepository(async () => {
        throw new Error("tenant database unavailable");
      }),
      domains: {
        findByHostname: async () => undefined,
        findById: async () => undefined,
      },
    });

    await expect(
      reader.resolve({
        hostname: "shop.sites.example.com",
        freeHostname: "shop.sites.example.com",
        organizationId: ORGANIZATION_ID,
      }),
    ).rejects.toThrow("tenant database unavailable");
  });
});

function siteRepository(findCurrent: () => Promise<Site | undefined>) {
  return {
    findCurrent,
    insert: async () => "inserted" as const,
    save: async () => undefined,
  };
}
