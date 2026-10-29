import { ERROR_CODE } from "@banijjik/contracts";
import { SITE_DOMAIN_STATUS } from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type OrganizationId,
  type SiteDomainId,
  type SiteId,
  type UserId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { SiteDomain } from "./site-domain.entity.js";

const NOW = new Date("2026-10-29T00:00:00.000Z");
const LATER = new Date("2026-10-29T01:00:00.000Z");
const ACTOR = asId<UserId>(newId());

function pendingDomain(): SiteDomain {
  return SiteDomain.create({
    siteDomainId: asId<SiteDomainId>(newId()),
    organizationId: asId<OrganizationId>(newId()),
    siteId: asId<SiteId>(newId()),
    hostname: "shop.example.com",
    now: NOW,
    actorUserId: ACTOR,
  });
}

describe("SiteDomain", () => {
  it("starts PENDING with empty DNS records and generation 1", () => {
    const domain = pendingDomain();
    expect(domain.status).toBe(SITE_DOMAIN_STATUS.PENDING);
    expect(domain.operationGeneration).toBe(1);
    expect(domain.ownershipRecords).toEqual([]);
    expect(domain.certificateRecords).toEqual([]);
    expect(domain.safeDiagnosticKey).toBeNull();
    expect(domain.version).toBe(1);
  });

  it("moves PENDING to VERIFYING without changing generation", () => {
    const verifying = pendingDomain().requestVerification({ now: LATER, actorUserId: ACTOR });
    expect(verifying.status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
    expect(verifying.operationGeneration).toBe(1);
    expect(verifying.version).toBe(2);
  });

  it("refuses verification of an ACTIVE domain", () => {
    const pending = pendingDomain();
    const active = SiteDomain.rehydrate({
      siteDomainId: pending.siteDomainId,
      organizationId: pending.organizationId,
      siteId: pending.siteId,
      hostname: pending.hostname,
      status: SITE_DOMAIN_STATUS.ACTIVE,
      providerHostnameId: pending.providerHostnameId,
      operationGeneration: pending.operationGeneration,
      nextAttemptAt: pending.nextAttemptAt,
      lastVerifiedAt: pending.lastVerifiedAt,
      ownershipRecords: pending.ownershipRecords,
      certificateRecords: pending.certificateRecords,
      safeDiagnosticKey: pending.safeDiagnosticKey,
      version: pending.version,
      createdAt: pending.createdAt,
      updatedAt: pending.updatedAt,
      createdByUserId: pending.createdByUserId,
      updatedByUserId: pending.updatedByUserId,
    });
    expect(() => active.requestVerification({ now: LATER, actorUserId: ACTOR })).toThrow(
      expect.objectContaining({ code: ERROR_CODE.WEBSITE_DOMAIN_NOT_READY }),
    );
  });

  it("moves to REMOVING and keeps the claim generation", () => {
    const removing = pendingDomain().requestRemoval({ now: LATER, actorUserId: ACTOR });
    expect(removing.status).toBe(SITE_DOMAIN_STATUS.REMOVING);
    expect(removing.operationGeneration).toBe(1);
  });

  it("activates VERIFYING, suspends ACTIVE, and recovers SUSPENDED into VERIFYING", () => {
    const verifying = pendingDomain().requestVerification({ now: LATER, actorUserId: ACTOR });
    const active = verifying.activate({ now: LATER, nextAttemptAt: LATER });
    expect(active.status).toBe(SITE_DOMAIN_STATUS.ACTIVE);
    const suspended = active.suspend({ now: LATER, diagnosticKey: "pending_validation" });
    expect(suspended.status).toBe(SITE_DOMAIN_STATUS.SUSPENDED);
    expect(suspended.recoverToVerifying({ now: LATER }).status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
  });
});
