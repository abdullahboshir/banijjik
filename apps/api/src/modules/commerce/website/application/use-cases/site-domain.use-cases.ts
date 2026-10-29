import { AUDIT_ACTION, DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  SITE_DOMAIN_STATUS,
  WEBSITE_EVENT_TYPE,
  type SiteDomainListResponse,
  type SiteDomainResponse,
} from "@banijjik/contracts/website";
import { asId, newId, type SiteDomainId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { normalizeHostname, type HostClaims } from "../../../../platform/operations/index.js";
import { versionConflict } from "../../domain/errors.js";
import { SiteDomain } from "../../domain/site-domain.entity.js";
import type { Site } from "../../domain/site.entity.js";
import type { SiteRepository } from "../ports/site-repository.js";
import type {
  SiteDomainEventPublisher,
  SiteDomainEventType,
  SiteDomainRepository,
  SiteDomainUnitOfWork,
} from "../ports/site-domain-ports.js";

export interface SiteDomainDependencies {
  readonly sites: SiteRepository;
  readonly domains: SiteDomainRepository;
  readonly hostClaims: HostClaims;
  readonly unitOfWork: SiteDomainUnitOfWork;
  readonly events: SiteDomainEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

function missing(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

function taken(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.WEBSITE_DOMAIN_TAKEN });
}

function invalidHost(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.WEBSITE_DOMAIN_INVALID });
}

function notReady(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.WEBSITE_DOMAIN_NOT_READY });
}

function orderingKeyOf(organizationId: string): string {
  return `website:${organizationId}`;
}

function toResponse(domain: SiteDomain, canonicalSiteDomainId: string | null): SiteDomainResponse {
  return {
    siteDomainId: domain.siteDomainId,
    hostname: domain.hostname,
    status: domain.status,
    version: domain.version,
    ownershipRecords: domain.ownershipRecords,
    certificateRecords: domain.certificateRecords,
    diagnosticKey: domain.safeDiagnosticKey,
    isCanonical: canonicalSiteDomainId === domain.siteDomainId,
  };
}

function mapHostClaimError(error: unknown): never {
  if (error instanceof DomainRuleError && error.code === ERROR_CODE.DUPLICATE) throw taken();
  if (error instanceof DomainRuleError && error.code === ERROR_CODE.VALIDATION_ERROR) {
    throw invalidHost();
  }
  throw error;
}

async function requireSite(sites: SiteRepository): Promise<Site> {
  const site = await sites.findCurrent();
  if (site === undefined) throw missing();
  return site;
}

async function requireDomain(
  domains: SiteDomainRepository,
  siteDomainId: string,
  expectedVersion: number,
): Promise<SiteDomain> {
  const domain = await domains.findById(asId<SiteDomainId>(siteDomainId));
  if (domain === undefined) throw missing();
  if (domain.version !== expectedVersion) throw versionConflict();
  return domain;
}

async function record(
  dependencies: Pick<SiteDomainDependencies, "audit" | "events">,
  input: {
    readonly action: (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
    readonly domain: SiteDomain;
    readonly type: SiteDomainEventType;
  },
): Promise<void> {
  await dependencies.audit.record({
    action: input.action,
    entityType: "siteDomain",
    entityId: input.domain.siteDomainId,
    changes: { status: { to: input.domain.status } },
  });
  await dependencies.events.publish(
    input.type,
    {
      siteDomainId: input.domain.siteDomainId,
      operationGeneration: input.domain.operationGeneration,
    },
    { orderingKey: orderingKeyOf(input.domain.organizationId) },
  );
}

function storedHostname(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  if (normalized === undefined) throw invalidHost();
  return normalized;
}

export class RequestSiteDomainUseCase {
  constructor(private readonly dependencies: SiteDomainDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly hostname: string;
  }): Promise<SiteDomainResponse> {
    const site = await requireSite(this.dependencies.sites);
    const siteDomainId = asId<SiteDomainId>(newId());
    return this.dependencies.unitOfWork.run(async () => {
      const domain = await this.reserveAndInsert(site, siteDomainId, input);
      await record(this.dependencies, {
        action: AUDIT_ACTION.WEBSITE_DOMAIN_CREATED,
        domain,
        type: WEBSITE_EVENT_TYPE.DOMAIN_REQUESTED,
      });
      return toResponse(domain, site.canonicalSiteDomainId);
    });
  }

  private async reserveAndInsert(
    site: Site,
    siteDomainId: SiteDomainId,
    input: { readonly actorUserId: UserId; readonly hostname: string },
  ): Promise<SiteDomain> {
    try {
      await this.dependencies.hostClaims.reserve({
        hostname: input.hostname,
        organizationId: site.organizationId,
        siteDomainId,
        operationGeneration: 1,
        actorUserId: input.actorUserId,
      });
    } catch (error) {
      mapHostClaimError(error);
    }
    const hostname = storedHostname(input.hostname);
    const domain = SiteDomain.create({
      siteDomainId,
      organizationId: site.organizationId,
      siteId: site.siteId,
      hostname,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    const outcome = await this.dependencies.domains.insert(domain);
    if (outcome === "duplicate") throw taken();
    return domain;
  }
}

export class VerifySiteDomainUseCase {
  constructor(private readonly dependencies: SiteDomainDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly siteDomainId: string;
    readonly version: number;
  }): Promise<SiteDomainResponse> {
    const site = await requireSite(this.dependencies.sites);
    const current = await requireDomain(
      this.dependencies.domains,
      input.siteDomainId,
      input.version,
    );
    const domain = current.requestVerification({
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    return this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.domains.save(domain, input.version);
      await record(this.dependencies, {
        action: AUDIT_ACTION.WEBSITE_DOMAIN_VERIFICATION_REQUESTED,
        domain,
        type: WEBSITE_EVENT_TYPE.DOMAIN_VERIFICATION_REQUESTED,
      });
      return toResponse(domain, site.canonicalSiteDomainId);
    });
  }
}

export class RemoveSiteDomainUseCase {
  constructor(private readonly dependencies: SiteDomainDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly siteDomainId: string;
    readonly version: number;
  }): Promise<SiteDomainResponse> {
    const site = await requireSite(this.dependencies.sites);
    const current = await requireDomain(
      this.dependencies.domains,
      input.siteDomainId,
      input.version,
    );
    const domain = current.requestRemoval({
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    const nextSite =
      site.canonicalSiteDomainId === domain.siteDomainId
        ? site.clearCanonical({
            now: this.dependencies.clock.now(),
            actorUserId: input.actorUserId,
          })
        : site;
    return this.dependencies.unitOfWork.run(async () => {
      try {
        await this.dependencies.hostClaims.disable({
          siteDomainId: domain.siteDomainId,
          operationGeneration: domain.operationGeneration,
          actorUserId: input.actorUserId,
        });
      } catch (error) {
        mapHostClaimError(error);
      }
      await this.dependencies.domains.save(domain, input.version);
      if (nextSite !== site) await this.dependencies.sites.save(nextSite, site.version);
      await record(this.dependencies, {
        action: AUDIT_ACTION.WEBSITE_DOMAIN_REMOVAL_REQUESTED,
        domain,
        type: WEBSITE_EVENT_TYPE.DOMAIN_REMOVAL_REQUESTED,
      });
      return toResponse(domain, nextSite.canonicalSiteDomainId);
    });
  }
}

export class SelectCanonicalSiteDomainUseCase {
  constructor(private readonly dependencies: SiteDomainDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly siteDomainId: string;
    readonly version: number;
    readonly expectedSiteVersion: number;
  }): Promise<SiteDomainResponse> {
    const site = await requireSite(this.dependencies.sites);
    if (site.version !== input.expectedSiteVersion) throw versionConflict();
    const domain = await requireDomain(
      this.dependencies.domains,
      input.siteDomainId,
      input.version,
    );
    if (domain.status !== SITE_DOMAIN_STATUS.ACTIVE) throw notReady();
    const nextSite = site.setCanonical({
      siteDomainId: domain.siteDomainId,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    return this.dependencies.unitOfWork.run(async () => {
      const latest = await this.dependencies.domains.findById(domain.siteDomainId);
      if (latest === undefined) throw missing();
      if (latest.version !== input.version) throw versionConflict();
      if (latest.status !== SITE_DOMAIN_STATUS.ACTIVE) throw notReady();
      await this.dependencies.sites.save(nextSite, input.expectedSiteVersion);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.WEBSITE_DOMAIN_CANONICAL_SELECTED,
        entityType: "site",
        entityId: site.siteId,
        changes: { canonicalSiteDomainId: { to: domain.siteDomainId } },
      });
      return toResponse(latest, nextSite.canonicalSiteDomainId);
    });
  }
}

export class ListSiteDomainsUseCase {
  constructor(private readonly dependencies: Pick<SiteDomainDependencies, "sites" | "domains">) {}

  async execute(input: {
    readonly page: number;
    readonly limit: number;
  }): Promise<SiteDomainListResponse> {
    const site = await requireSite(this.dependencies.sites);
    const page = await this.dependencies.domains.listPage(input);
    return {
      items: page.items.map((domain) => toResponse(domain, site.canonicalSiteDomainId)),
      total: page.total,
      page: input.page,
      limit: input.limit,
    };
  }
}
