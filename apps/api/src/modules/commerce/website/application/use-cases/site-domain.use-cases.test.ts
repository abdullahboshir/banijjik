import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  SITE_DOMAIN_STATUS,
  WEBSITE_EVENT_TYPE,
  type DomainEventPayload,
} from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type SiteDomainId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { InMemoryAuditRecorder } from "../../../../../test-support/audit-fakes.js";
import { MutableClock } from "../../../../../test-support/mutable-clock.js";
import { InMemorySiteRepository, seedSite } from "../../../../../test-support/site-fixtures.js";
import { InlineUnitOfWork } from "../../../../../test-support/site-publication-fakes.js";
import type {
  DisableHostClaimInput,
  HostClaimResolution,
  HostClaims,
  ReserveHostClaimInput,
} from "../../../../platform/operations/index.js";
import { SiteDomain } from "../../domain/site-domain.entity.js";
import type {
  SiteDomainEventPublisher,
  SiteDomainEventType,
  SiteDomainRepository,
} from "../ports/site-domain-ports.js";
import {
  ListSiteDomainsUseCase,
  RemoveSiteDomainUseCase,
  RequestSiteDomainUseCase,
  SelectCanonicalSiteDomainUseCase,
  VerifySiteDomainUseCase,
  type SiteDomainDependencies,
} from "./site-domain.use-cases.js";

const ACTOR = asId<UserId>(newId());

class FakeHostClaims implements HostClaims {
  readonly reserved: ReserveHostClaimInput[] = [];
  readonly disabled: DisableHostClaimInput[] = [];
  private readonly byHost = new Map<string, ReserveHostClaimInput>();
  mismatchGeneration: number | undefined;

  async reserve(input: ReserveHostClaimInput): Promise<void> {
    const hostname = input.hostname.trim().toLowerCase();
    if (hostname.includes(":") || hostname.includes("@") || hostname === "sites.example.com") {
      throw new DomainRuleError({ code: ERROR_CODE.VALIDATION_ERROR });
    }
    const holder = this.byHost.get(hostname);
    if (holder !== undefined && holder.siteDomainId !== input.siteDomainId) {
      throw new DomainRuleError({ code: ERROR_CODE.DUPLICATE });
    }
    this.byHost.set(hostname, { ...input, hostname });
    this.reserved.push(input);
  }

  async disable(input: DisableHostClaimInput): Promise<void> {
    if (
      this.mismatchGeneration !== undefined &&
      this.mismatchGeneration !== input.operationGeneration
    ) {
      throw new DomainRuleError({ code: ERROR_CODE.CONFLICT });
    }
    this.disabled.push(input);
  }

  async resolve(hostname: string): Promise<HostClaimResolution | undefined> {
    const holder = this.byHost.get(hostname.trim().toLowerCase());
    if (holder === undefined) return undefined;
    return {
      organizationId: holder.organizationId,
      hostname: holder.hostname,
      domainGeneration: holder.operationGeneration,
    };
  }
}

class InMemorySiteDomainRepository implements SiteDomainRepository {
  rows: SiteDomain[] = [];

  async insert(domain: SiteDomain): Promise<"inserted" | "duplicate"> {
    if (this.rows.some((row) => row.hostname === domain.hostname)) return "duplicate";
    this.rows.push(domain);
    return "inserted";
  }

  async findById(siteDomainId: SiteDomainId): Promise<SiteDomain | undefined> {
    return this.rows.find((row) => row.siteDomainId === siteDomainId);
  }

  async save(domain: SiteDomain, expectedVersion: number): Promise<void> {
    const index = this.rows.findIndex((row) => row.siteDomainId === domain.siteDomainId);
    const current = this.rows[index];
    if (index < 0 || current === undefined || current.version !== expectedVersion) {
      throw new Error("stale version");
    }
    this.rows[index] = domain;
  }

  async listPage(input: {
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly SiteDomain[]; readonly total: number }> {
    const start = (input.page - 1) * input.limit;
    return { items: this.rows.slice(start, start + input.limit), total: this.rows.length };
  }

  async listDuePage(): Promise<readonly SiteDomain[]> {
    return [];
  }
}

class RecordingEvents implements SiteDomainEventPublisher {
  readonly published: {
    type: SiteDomainEventType;
    payload: DomainEventPayload;
    orderingKey: string;
  }[] = [];

  async publish(
    type: SiteDomainEventType,
    payload: DomainEventPayload,
    options: { readonly orderingKey: string },
  ): Promise<void> {
    this.published.push({ type, payload, orderingKey: options.orderingKey });
  }
}

function withStatus(
  domain: SiteDomain,
  status: (typeof SITE_DOMAIN_STATUS)[keyof typeof SITE_DOMAIN_STATUS],
): SiteDomain {
  return SiteDomain.rehydrate({
    siteDomainId: domain.siteDomainId,
    organizationId: domain.organizationId,
    siteId: domain.siteId,
    hostname: domain.hostname,
    status,
    providerHostnameId: domain.providerHostnameId,
    operationGeneration: domain.operationGeneration,
    nextAttemptAt: domain.nextAttemptAt,
    lastVerifiedAt: domain.lastVerifiedAt,
    ownershipRecords: domain.ownershipRecords,
    certificateRecords: domain.certificateRecords,
    safeDiagnosticKey: domain.safeDiagnosticKey,
    version: domain.version,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    createdByUserId: domain.createdByUserId,
    updatedByUserId: domain.updatedByUserId,
  });
}

function domainStack(input?: {
  readonly sites?: InMemorySiteRepository;
  readonly hostClaims?: FakeHostClaims;
}): Omit<SiteDomainDependencies, "sites" | "hostClaims" | "domains" | "events"> & {
  readonly sites: InMemorySiteRepository;
  readonly hostClaims: FakeHostClaims;
  readonly events: RecordingEvents;
  readonly domains: InMemorySiteDomainRepository;
} {
  const events = new RecordingEvents();
  const hostClaims = input?.hostClaims ?? new FakeHostClaims();
  const domains = new InMemorySiteDomainRepository();
  return {
    sites: input?.sites ?? new InMemorySiteRepository(),
    domains,
    hostClaims,
    unitOfWork: new InlineUnitOfWork(),
    events,
    audit: new InMemoryAuditRecorder(),
    clock: new MutableClock(new Date("2026-10-29T00:00:00.000Z")),
  };
}

describe("RequestSiteDomainUseCase", () => {
  it("reserves the host and returns  PENDING with empty DNS records", async () => {
    const stack = domainStack();
    seedSite(stack.sites);
    const created = await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "Shop.Example.COM",
    });
    expect(created.status).toBe(SITE_DOMAIN_STATUS.PENDING);
    expect(created.hostname).toBe("shop.example.com");
    expect(created.ownershipRecords).toEqual([]);
    expect(created.isCanonical).toBe(false);
    expect(stack.hostClaims.reserved).toHaveLength(1);
    expect(stack.events.published[0]?.type).toBe(WEBSITE_EVENT_TYPE.DOMAIN_REQUESTED);
  });

  it("answers NOT_FOUND when the organization has no Site", async () => {
    const stack = domainStack();
    await expect(
      new RequestSiteDomainUseCase(stack).execute({
        actorUserId: ACTOR,
        hostname: "shop.example.com",
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND });
    expect(stack.hostClaims.reserved).toHaveLength(0);
  });

  it("maps a taken host to WEBSITE_DOMAIN_TAKEN", async () => {
    const hostClaims = new FakeHostClaims();
    await hostClaims.reserve({
      hostname: "shop.example.com",
      organizationId: asId<OrganizationId>(newId()),
      siteDomainId: asId<SiteDomainId>(newId()),
      operationGeneration: 1,
    });
    const stack = domainStack({ hostClaims });
    seedSite(stack.sites);
    await expect(
      new RequestSiteDomainUseCase(stack).execute({
        actorUserId: ACTOR,
        hostname: "shop.example.com",
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.WEBSITE_DOMAIN_TAKEN });
  });
});

describe("VerifySiteDomainUseCase", () => {
  it("writes VERIFYING and the outbox event without calling a provider", async () => {
    const stack = domainStack();
    seedSite(stack.sites);
    const created = await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "shop.example.com",
    });
    const verified = await new VerifySiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      siteDomainId: created.siteDomainId,
      version: created.version,
    });
    expect(verified.status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
    expect(stack.events.published.map((event) => event.type)).toEqual([
      WEBSITE_EVENT_TYPE.DOMAIN_REQUESTED,
      WEBSITE_EVENT_TYPE.DOMAIN_VERIFICATION_REQUESTED,
    ]);
    expect(stack.hostClaims.reserved).toHaveLength(1);
    expect(stack.hostClaims.disabled).toHaveLength(0);
  });
});

describe("RemoveSiteDomainUseCase", () => {
  it("disables the claim and clears a matching canonical pointer", async () => {
    const stack = domainStack();
    const site = seedSite(stack.sites);
    const created = await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "shop.example.com",
    });
    const stored = stack.domains.rows[0];
    if (stored === undefined) throw new Error("domain missing");
    stack.domains.rows[0] = withStatus(stored, SITE_DOMAIN_STATUS.ACTIVE);
    stack.sites.site = site.setCanonical({
      siteDomainId: asId<SiteDomainId>(created.siteDomainId),
      now: stack.clock.now(),
      actorUserId: ACTOR,
    });
    const removed = await new RemoveSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      siteDomainId: created.siteDomainId,
      version: stored.version,
    });
    expect(removed.status).toBe(SITE_DOMAIN_STATUS.REMOVING);
    expect(removed.isCanonical).toBe(false);
    expect(stack.sites.site?.canonicalSiteDomainId).toBeNull();
    expect(stack.hostClaims.disabled[0]?.operationGeneration).toBe(1);
  });

  it("refuses delete when the claim generation has moved on", async () => {
    const hostClaims = new FakeHostClaims();
    hostClaims.mismatchGeneration = 2;
    const stack = domainStack({ hostClaims });
    seedSite(stack.sites);
    const created = await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "shop.example.com",
    });
    await expect(
      new RemoveSiteDomainUseCase(stack).execute({
        actorUserId: ACTOR,
        siteDomainId: created.siteDomainId,
        version: created.version,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
    expect(stack.domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.PENDING);
  });
});

describe("SelectCanonicalSiteDomainUseCase", () => {
  it("refuses a non-ACTIVE domain", async () => {
    const stack = domainStack();
    const site = seedSite(stack.sites);
    const created = await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "shop.example.com",
    });
    await expect(
      new SelectCanonicalSiteDomainUseCase(stack).execute({
        actorUserId: ACTOR,
        siteDomainId: created.siteDomainId,
        version: created.version,
        expectedSiteVersion: site.version,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.WEBSITE_DOMAIN_NOT_READY });
  });
});

describe("ListSiteDomainsUseCase", () => {
  it("pages this organization's hosts", async () => {
    const stack = domainStack();
    seedSite(stack.sites);
    await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "one.example.com",
    });
    await new RequestSiteDomainUseCase(stack).execute({
      actorUserId: ACTOR,
      hostname: "two.example.com",
    });
    const page = await new ListSiteDomainsUseCase(stack).execute({ page: 1, limit: 1 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.limit).toBe(1);
  });
});
