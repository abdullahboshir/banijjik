import { MODULE_KEY } from "@banijjik/contracts";
import { SITE_DOMAIN_STATUS } from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type OrganizationId,
  type SiteDomainId,
  type SiteId,
  type UserId,
} from "@banijjik/ids";
import { beforeEach, describe, expect, it } from "vitest";
import { createLogger, setRootLogger } from "../../../../../kernel/logger/index.js";
import { MutableClock } from "../../../../../test-support/mutable-clock.js";
import { InMemorySiteRepository, seedSite } from "../../../../../test-support/site-fixtures.js";
import { InlineUnitOfWork } from "../../../../../test-support/site-publication-fakes.js";
import {
  DOMAIN_OPERATION_ACTION,
  DomainOperation,
  ProviderUnavailableError,
  type DomainOperationRepository,
  type DomainProvider,
  type EnsureDomainResult,
  type InspectDomainResult,
} from "../../../../platform/operations/index.js";
import { SiteDomain } from "../../domain/site-domain.entity.js";
import type { SiteDomainEventPublisher, SiteDomainRepository } from "../ports/site-domain-ports.js";
import {
  buildReconcileDomainsJob,
  DUE_PAGE_SIZE,
  ProcessDueSiteDomainsUseCase,
} from "./process-site-domain.use-case.js";

const ACTOR = asId<UserId>(newId());
const NOW = new Date("2026-10-29T05:00:00.000Z");
const PENDING_INSPECT: InspectDomainResult = {
  hostnameActive: true,
  certificateActive: false,
  dnsTargetsService: true,
  ownershipRecords: [],
  certificateRecords: [],
  diagnosticKey: "pending_validation",
  providerHostnameId: "cf-1",
};
const ACTIVE_INSPECT: InspectDomainResult = {
  hostnameActive: true,
  certificateActive: true,
  dnsTargetsService: true,
  ownershipRecords: [],
  certificateRecords: [],
  diagnosticKey: "active",
  providerHostnameId: "cf-1",
};

class FakeProvider implements DomainProvider {
  ensureCalls = 0;
  inspectCalls = 0;
  removeCalls = 0;
  throwOnEnsure = false;
  throwOnInspect = false;
  inspectResult: InspectDomainResult = PENDING_INSPECT;

  async ensure(): Promise<EnsureDomainResult> {
    this.ensureCalls += 1;
    if (this.throwOnEnsure) throw new ProviderUnavailableError();
    return {
      providerHostnameId: "cf-1",
      ownershipRecords: [{ type: "TXT", name: "_cf", value: "v" }],
      certificateRecords: [],
    };
  }

  async inspect(): Promise<InspectDomainResult> {
    this.inspectCalls += 1;
    if (this.throwOnInspect) throw new ProviderUnavailableError();
    return this.inspectResult;
  }

  async remove(): Promise<void> {
    this.removeCalls += 1;
  }
}

class InMemoryOperations implements DomainOperationRepository {
  rows: DomainOperation[] = [];

  async findByNaturalKey(input: {
    readonly siteDomainId: SiteDomainId;
    readonly generation: number;
    readonly action: (typeof DOMAIN_OPERATION_ACTION)[keyof typeof DOMAIN_OPERATION_ACTION];
  }): Promise<DomainOperation | undefined> {
    return this.rows.find(
      (row) =>
        row.siteDomainId === input.siteDomainId &&
        row.generation === input.generation &&
        row.action === input.action,
    );
  }

  async insert(operation: DomainOperation): Promise<"inserted" | "duplicate"> {
    if (
      this.rows.some(
        (row) =>
          row.siteDomainId === operation.siteDomainId &&
          row.generation === operation.generation &&
          row.action === operation.action,
      )
    ) {
      return "duplicate";
    }
    this.rows.push(operation);
    return "inserted";
  }

  async save(operation: DomainOperation, expectedVersion: number): Promise<void> {
    const index = this.rows.findIndex(
      (row) => row.domainOperationId === operation.domainOperationId,
    );
    const current = this.rows[index];
    if (index < 0 || current === undefined || current.version !== expectedVersion) {
      throw new Error("stale");
    }
    this.rows[index] = operation;
  }
}

class InMemoryDomains implements SiteDomainRepository {
  rows: SiteDomain[] = [];
  dueLimits: number[] = [];

  async insert(domain: SiteDomain): Promise<"inserted" | "duplicate"> {
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
      throw new Error("stale");
    }
    this.rows[index] = domain;
  }

  async listPage(): Promise<{ readonly items: readonly SiteDomain[]; readonly total: number }> {
    return { items: this.rows, total: this.rows.length };
  }

  async listDuePage(input: {
    readonly now: Date;
    readonly afterSiteDomainId?: SiteDomainId;
    readonly limit: number;
  }): Promise<readonly SiteDomain[]> {
    this.dueLimits.push(input.limit);
    return this.rows
      .filter((row) => row.nextAttemptAt.getTime() <= input.now.getTime())
      .filter(
        (row) =>
          input.afterSiteDomainId === undefined || row.siteDomainId > input.afterSiteDomainId,
      )
      .sort((left, right) => left.siteDomainId.localeCompare(right.siteDomainId))
      .slice(0, input.limit);
  }
}

class SilentEvents implements SiteDomainEventPublisher {
  async publish(): Promise<void> {}
}

function verifyingDomain(organizationId: OrganizationId, siteId: SiteId): SiteDomain {
  return SiteDomain.create({
    siteDomainId: asId<SiteDomainId>(newId()),
    organizationId,
    siteId,
    hostname: `shop-${newId().slice(0, 8)}.example.com`,
    now: NOW,
    actorUserId: ACTOR,
  }).requestVerification({ now: NOW, actorUserId: ACTOR });
}

function recordedActive(organizationId: OrganizationId, siteId: SiteId): SiteDomain {
  return verifyingDomain(organizationId, siteId)
    .recordProvider({
      providerHostnameId: "cf-1",
      ownershipRecords: [],
      certificateRecords: [],
      diagnosticKey: "active",
      now: NOW,
    })
    .activate({ now: NOW, nextAttemptAt: NOW });
}

function createUseCase(input: {
  readonly provider: FakeProvider;
  readonly domains: InMemoryDomains;
  readonly operations?: InMemoryOperations;
}) {
  const sites = new InMemorySiteRepository();
  const site = seedSite(sites);
  const operations = input.operations ?? new InMemoryOperations();
  return {
    site,
    operations,
    useCase: new ProcessDueSiteDomainsUseCase({
      domains: input.domains,
      sites,
      operations,
      provider: input.provider,
      unitOfWork: new InlineUnitOfWork(),
      events: new SilentEvents(),
      clock: new MutableClock(NOW),
    }),
  };
}

describe("ProcessDueSiteDomainsUseCase", () => {
  beforeEach(() => {
    setRootLogger(createLogger({ level: "info", destination: { write() {} } }));
  });

  it("does not activate when the hostname is active but TLS is still pending", async () => {
    const provider = new FakeProvider();
    const domains = new InMemoryDomains();
    const { site, useCase } = createUseCase({ provider, domains });
    await domains.insert(verifyingDomain(site.organizationId, site.siteId));
    await useCase.execute(NOW);
    expect(domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
    expect(provider.ensureCalls).toBe(1);
  });

  it("reconciles a timed-out ensure by hostname without a second ensure", async () => {
    const provider = new FakeProvider();
    provider.inspectResult = { ...ACTIVE_INSPECT, providerHostnameId: "cf-recovered" };
    const domains = new InMemoryDomains();
    const operations = new InMemoryOperations();
    const { site, useCase } = createUseCase({ provider, domains, operations });
    const domain = verifyingDomain(site.organizationId, site.siteId);
    await domains.insert(domain);
    await operations.insert(
      DomainOperation.start({
        organizationId: domain.organizationId,
        siteDomainId: domain.siteDomainId,
        generation: domain.operationGeneration,
        action: DOMAIN_OPERATION_ACTION.ENSURE,
        now: NOW,
      }).attachProviderHostname({ providerHostnameId: "cf-recovered", now: NOW }),
    );
    await useCase.execute(NOW);
    expect(provider.ensureCalls).toBe(0);
    expect(domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.ACTIVE);
    expect(domains.rows[0]?.providerHostnameId).toBe("cf-recovered");
  });

  it("leaves ACTIVE unchanged when the provider is down", async () => {
    const provider = new FakeProvider();
    provider.throwOnInspect = true;
    const domains = new InMemoryDomains();
    const { site, useCase } = createUseCase({ provider, domains });
    await domains.insert(recordedActive(site.organizationId, site.siteId));
    await useCase.execute(NOW);
    expect(domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.ACTIVE);
  });

  it("recovers SUSPENDED into VERIFYING when proof returns", async () => {
    const provider = new FakeProvider();
    provider.inspectResult = ACTIVE_INSPECT;
    const domains = new InMemoryDomains();
    const { site, useCase } = createUseCase({ provider, domains });
    await domains.insert(
      recordedActive(site.organizationId, site.siteId).suspend({
        now: NOW,
        diagnosticKey: "pending_validation",
      }),
    );
    await useCase.execute(NOW);
    expect(domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
  });

  it("marks REMOVING with no provider id as REMOVED without calling Cloudflare", async () => {
    const provider = new FakeProvider();
    const domains = new InMemoryDomains();
    const { site, useCase } = createUseCase({ provider, domains });
    await domains.insert(
      verifyingDomain(site.organizationId, site.siteId).requestRemoval({
        now: NOW,
        actorUserId: ACTOR,
      }),
    );
    await useCase.execute(NOW);
    expect(domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.REMOVED);
    expect(provider.removeCalls).toBe(0);
  });

  it("does not call the provider for a late job of an older generation", async () => {
    const provider = new FakeProvider();
    const domains = new InMemoryDomains();
    const { site, useCase } = createUseCase({ provider, domains });
    const domain = verifyingDomain(site.organizationId, site.siteId);
    await domains.insert(domain);
    await useCase.processSafely(domain, NOW, domain.operationGeneration - 1);
    expect(provider.ensureCalls).toBe(0);
    expect(domains.rows[0]?.status).toBe(SITE_DOMAIN_STATUS.VERIFYING);
  });

  it("processes due rows in keyset pages of 100 and continues when one row throws", async () => {
    const provider = new FakeProvider();
    provider.inspectResult = ACTIVE_INSPECT;
    const domains = new InMemoryDomains();
    const { site, useCase } = createUseCase({ provider, domains });
    await domains.insert(verifyingDomain(site.organizationId, site.siteId));
    await domains.insert(verifyingDomain(site.organizationId, site.siteId));
    const originalSave = domains.save.bind(domains);
    let calls = 0;
    domains.save = async (domain, expected) => {
      calls += 1;
      if (calls === 1) throw new Error("row failed");
      return originalSave(domain, expected);
    };
    await useCase.execute(NOW);
    expect(domains.dueLimits[0]).toBe(DUE_PAGE_SIZE);
    expect(domains.rows.some((row) => row.status === SITE_DOMAIN_STATUS.ACTIVE)).toBe(true);
  });

  it("registers website.reconcileDomains every five minutes on the website module", () => {
    const job = buildReconcileDomainsJob({
      useCase: createUseCase({ provider: new FakeProvider(), domains: new InMemoryDomains() })
        .useCase,
    });
    expect(job.jobKey).toBe("website.reconcileDomains");
    expect(job.everyMinutes).toBe(5);
    expect(job.moduleKey).toBe(MODULE_KEY.WEBSITE);
  });
});
