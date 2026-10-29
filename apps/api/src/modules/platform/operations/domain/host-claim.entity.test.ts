import { asId, newId, type OrganizationId, type SiteDomainId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  HostClaimGenerationMismatchError,
  HostClaimQuarantinedError,
  HostClaimTakenError,
} from "./errors.js";
import { HOST_CLAIM_QUARANTINE_MS, HostClaim } from "./host-claim.entity.js";

const NOW = new Date("2026-10-28T10:00:00.000Z");
const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);
const AFTER_QUARANTINE = new Date(NOW.getTime() + HOST_CLAIM_QUARANTINE_MS + 1);

const organizationA = asId<OrganizationId>(newId());
const organizationB = asId<OrganizationId>(newId());
const domainA = asId<SiteDomainId>(newId());
const domainB = asId<SiteDomainId>(newId());
const staffUser = asId<UserId>(newId());

function aClaim(): HostClaim {
  return HostClaim.create({
    hostname: "shop.example.com",
    organizationId: organizationA,
    siteDomainId: domainA,
    operationGeneration: 1,
    now: NOW,
    actorUserId: staffUser,
  });
}

describe("HostClaim", () => {
  it("starts enabled, routable and at version 1", () => {
    const claim = aClaim();

    expect(claim.hostname).toBe("shop.example.com");
    expect(claim.enabled).toBe(true);
    expect(claim.isRoutable()).toBe(true);
    expect(claim.generation).toBe(1);
    expect(claim.quarantineUntil).toBeNull();
    expect(claim.version).toBe(1);
    expect(claim.createdByUserId).toBe(staffUser);
  });

  it("stops routing and starts the quarantine on disable", () => {
    const disabled = aClaim().disable({ operationGeneration: 1, now: NOW, actorUserId: null });

    expect(disabled.isRoutable()).toBe(false);
    expect(disabled.version).toBe(2);
    expect(disabled.quarantineUntil?.getTime()).toBe(NOW.getTime() + HOST_CLAIM_QUARANTINE_MS);
    expect(disabled.isQuarantinedAt(LATER)).toBe(true);
    expect(disabled.isQuarantinedAt(AFTER_QUARANTINE)).toBe(false);
    expect(disabled.updatedByUserId).toBeNull();
  });

  it("disabling an already disabled claim changes nothing", () => {
    const claim = aClaim();
    const disabled = claim.disable({ operationGeneration: 1, now: NOW, actorUserId: null });

    expect(disabled.disable({ operationGeneration: 1, now: LATER, actorUserId: null })).toBe(
      disabled,
    );
  });

  it("refuses a disable from another operation generation", () => {
    expect(() => aClaim().disable({ operationGeneration: 2, now: NOW, actorUserId: null })).toThrow(
      HostClaimGenerationMismatchError,
    );
  });

  it("takes a new generation for an explicit retry of the same site domain", () => {
    const retried = aClaim().withGeneration({
      operationGeneration: 4,
      now: LATER,
      actorUserId: null,
    });

    expect(retried.generation).toBe(4);
    expect(retried.version).toBe(2);
    expect(retried.enabled).toBe(true);
    expect(retried.siteDomainId).toBe(domainA);
  });

  it("refuses to reclaim a host that is still enabled", () => {
    expect(() =>
      aClaim().reclaim({
        organizationId: organizationB,
        siteDomainId: domainB,
        operationGeneration: 1,
        now: NOW,
        actorUserId: null,
      }),
    ).toThrow(HostClaimTakenError);
  });

  it("refuses to reclaim a host whose quarantine has not lapsed", () => {
    const disabled = aClaim().disable({ operationGeneration: 1, now: NOW, actorUserId: null });

    expect(() =>
      disabled.reclaim({
        organizationId: organizationB,
        siteDomainId: domainB,
        operationGeneration: 1,
        now: LATER,
        actorUserId: null,
      }),
    ).toThrow(HostClaimQuarantinedError);
  });

  it("moves a lapsed host to its new owner and generation", () => {
    const disabled = aClaim().disable({ operationGeneration: 1, now: NOW, actorUserId: null });
    const reclaimed = disabled.reclaim({
      organizationId: organizationB,
      siteDomainId: domainB,
      operationGeneration: 9,
      now: AFTER_QUARANTINE,
      actorUserId: null,
    });

    expect(reclaimed.organizationId).toBe(organizationB);
    expect(reclaimed.siteDomainId).toBe(domainB);
    expect(reclaimed.generation).toBe(9);
    expect(reclaimed.enabled).toBe(true);
    expect(reclaimed.quarantineUntil).toBeNull();
    expect(reclaimed.version).toBe(3);
    expect(reclaimed.hostClaimId).toBe(disabled.hostClaimId);
    expect(reclaimed.createdByUserId).toBe(staffUser);
  });
});
