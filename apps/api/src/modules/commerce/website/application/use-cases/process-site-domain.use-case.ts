import { MODULE_KEY } from "@banijjik/contracts";
import { SITE_DOMAIN_STATUS, WEBSITE_EVENT_TYPE } from "@banijjik/contracts/website";
import type { SiteDomainId } from "@banijjik/ids";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import { getLogger } from "../../../../../kernel/logger/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  DOMAIN_OPERATION_ACTION,
  DOMAIN_OPERATION_STATE,
  DomainOperation,
  ProviderUnavailableError,
  type DomainOperationAction,
  type DomainOperationRepository,
  type DomainProvider,
  type InspectDomainResult,
} from "../../../../platform/operations/index.js";
import { SiteDomain } from "../../domain/site-domain.entity.js";
import type { SiteRepository } from "../ports/site-repository.js";
import type {
  SiteDomainEventPublisher,
  SiteDomainRepository,
  SiteDomainUnitOfWork,
} from "../ports/site-domain-ports.js";

export const DUE_PAGE_SIZE = 100;
export const VERIFY_BACKOFF_MS = 60_000;
export const ACTIVE_RECONCILE_MS = 5 * 60 * 1000;
const TERMINAL_DIAGNOSTICS = new Set(["deleted", "moved", "blocked"]);

export interface ProcessDueSiteDomainsDependencies {
  readonly domains: SiteDomainRepository;
  readonly sites: SiteRepository;
  readonly operations: DomainOperationRepository;
  readonly provider: DomainProvider;
  readonly unitOfWork: SiteDomainUnitOfWork;
  readonly events: SiteDomainEventPublisher;
  readonly clock: Clock;
}

export class ProcessDueSiteDomainsUseCase {
  constructor(private readonly dependencies: ProcessDueSiteDomainsDependencies) {}

  async execute(now: Date = this.dependencies.clock.now()): Promise<void> {
    let afterSiteDomainId: SiteDomainId | undefined;
    for (;;) {
      const page = await this.dependencies.domains.listDuePage({
        now,
        ...(afterSiteDomainId === undefined ? {} : { afterSiteDomainId }),
        limit: DUE_PAGE_SIZE,
      });
      for (const domain of page) await this.processSafely(domain, now);
      if (page.length < DUE_PAGE_SIZE) return;
      afterSiteDomainId = page[page.length - 1]?.siteDomainId;
    }
  }

  async processSafely(domain: SiteDomain, now: Date, expectedGeneration?: number): Promise<void> {
    try {
      if (expectedGeneration !== undefined && expectedGeneration !== domain.operationGeneration) {
        return;
      }
      await this.process(domain, now);
    } catch (error) {
      getLogger().error(
        { event: "website.domain_job_failed", siteDomainId: domain.siteDomainId, err: error },
        "one domain row failed; continuing the page",
      );
    }
  }

  private async process(domain: SiteDomain, now: Date): Promise<void> {
    if (domain.status === SITE_DOMAIN_STATUS.VERIFYING) await this.processVerifying(domain, now);
    else if (domain.status === SITE_DOMAIN_STATUS.ACTIVE) await this.processActive(domain, now);
    else if (domain.status === SITE_DOMAIN_STATUS.SUSPENDED)
      await this.processSuspended(domain, now);
    else if (domain.status === SITE_DOMAIN_STATUS.REMOVING) await this.processRemoving(domain, now);
  }

  private async processVerifying(domain: SiteDomain, now: Date): Promise<void> {
    const ensured = await this.ensureHostname(domain, now);
    if (ensured === undefined) return;
    const inspected = await this.inspectOrBackoff(ensured, now);
    if (inspected === undefined) return;
    if (isFullyActive(inspected.inspect)) {
      await this.saveDomain(
        inspected.domain.activate({ now, nextAttemptAt: later(now, ACTIVE_RECONCILE_MS) }),
        inspected.domain.version,
      );
      return;
    }
    const diagnosticKey = inspected.inspect.diagnosticKey;
    if (diagnosticKey !== null && TERMINAL_DIAGNOSTICS.has(diagnosticKey)) {
      await this.saveDomain(
        inspected.domain.fail({ now, diagnosticKey }),
        inspected.domain.version,
      );
      return;
    }
    await this.backoff(inspected.domain, now, VERIFY_BACKOFF_MS);
  }

  private async processActive(domain: SiteDomain, now: Date): Promise<void> {
    let inspect: InspectDomainResult;
    try {
      inspect = await this.dependencies.provider.inspect(domain.hostname);
    } catch (error) {
      if (error instanceof ProviderUnavailableError) return;
      throw error;
    }
    if (isFullyActive(inspect)) {
      await this.backoff(domain, now, ACTIVE_RECONCILE_MS);
      return;
    }
    const suspended = domain.suspend({ now, diagnosticKey: inspect.diagnosticKey });
    await this.saveDomain(suspended, domain.version);
    await this.clearCanonicalIfMatch(suspended, now);
  }

  private async processSuspended(domain: SiteDomain, now: Date): Promise<void> {
    const inspected = await this.inspectOrBackoff(domain, now);
    if (inspected === undefined) return;
    if (isFullyActive(inspected.inspect)) {
      await this.saveDomain(inspected.domain.recoverToVerifying({ now }), inspected.domain.version);
      return;
    }
    await this.backoff(inspected.domain, now, VERIFY_BACKOFF_MS);
  }

  private async processRemoving(domain: SiteDomain, now: Date): Promise<void> {
    const operation = await this.beginOperation(domain, DOMAIN_OPERATION_ACTION.REMOVE, now);
    const providerHostnameId = domain.providerHostnameId ?? operation.providerHostnameId;
    if (providerHostnameId !== null) {
      try {
        await this.dependencies.provider.remove(providerHostnameId);
      } catch (error) {
        if (error instanceof ProviderUnavailableError) {
          await this.backoff(domain, now, VERIFY_BACKOFF_MS);
          return;
        }
        throw error;
      }
    }
    await this.completeOperation(operation, providerHostnameId, now);
    await this.saveDomain(domain.markRemoved({ now }), domain.version);
  }

  private async ensureHostname(domain: SiteDomain, now: Date): Promise<SiteDomain | undefined> {
    const operation = await this.beginOperation(domain, DOMAIN_OPERATION_ACTION.ENSURE, now);
    if (
      operation.state === DOMAIN_OPERATION_STATE.SUCCEEDED &&
      domain.providerHostnameId !== null
    ) {
      return domain;
    }
    try {
      const ensured =
        operation.providerHostnameId === null
          ? await this.dependencies.provider.ensure({
              hostname: domain.hostname,
              operationKey: `${domain.siteDomainId}:${domain.operationGeneration}`,
            })
          : await this.recoverEnsure(domain);
      if (ensured === undefined) return this.backoff(domain, now, VERIFY_BACKOFF_MS);
      const recorded = domain.recordProvider({
        providerHostnameId: ensured.providerHostnameId,
        ownershipRecords: ensured.ownershipRecords,
        certificateRecords: ensured.certificateRecords,
        diagnosticKey: null,
        now,
      });
      await this.completeOperation(operation, ensured.providerHostnameId, now);
      await this.saveDomain(recorded, domain.version);
      return recorded;
    } catch (error) {
      if (error instanceof ProviderUnavailableError)
        return this.backoff(domain, now, VERIFY_BACKOFF_MS);
      throw error;
    }
  }

  private async recoverEnsure(domain: SiteDomain) {
    const inspected = await this.dependencies.provider.inspect(domain.hostname);
    if (inspected.providerHostnameId === null) return undefined;
    return {
      providerHostnameId: inspected.providerHostnameId,
      ownershipRecords: inspected.ownershipRecords,
      certificateRecords: inspected.certificateRecords,
    };
  }

  private async inspectOrBackoff(domain: SiteDomain, now: Date) {
    try {
      return { domain, inspect: await this.dependencies.provider.inspect(domain.hostname) };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        await this.backoff(domain, now, VERIFY_BACKOFF_MS);
        return undefined;
      }
      throw error;
    }
  }

  private async backoff(domain: SiteDomain, now: Date, delayMs: number): Promise<undefined> {
    await this.saveDomain(
      domain.scheduleRetry({ now, nextAttemptAt: later(now, delayMs) }),
      domain.version,
    );
    return undefined;
  }

  private async beginOperation(
    domain: SiteDomain,
    action: DomainOperationAction,
    now: Date,
  ): Promise<DomainOperation> {
    const key = {
      siteDomainId: domain.siteDomainId,
      generation: domain.operationGeneration,
      action,
    };
    const existing = await this.dependencies.operations.findByNaturalKey(key);
    if (existing !== undefined) return existing;
    const created = DomainOperation.start({
      organizationId: domain.organizationId,
      siteDomainId: domain.siteDomainId,
      generation: domain.operationGeneration,
      action,
      now,
    });
    if ((await this.dependencies.operations.insert(created)) === "inserted") return created;
    const raced = await this.dependencies.operations.findByNaturalKey(key);
    if (raced === undefined) throw new Error("domain operation race lost");
    return raced;
  }

  private async completeOperation(
    operation: DomainOperation,
    providerHostnameId: string | null,
    now: Date,
  ): Promise<void> {
    if (operation.state === DOMAIN_OPERATION_STATE.SUCCEEDED) return;
    await this.dependencies.operations.save(
      operation.succeed({ providerHostnameId, now }),
      operation.version,
    );
  }

  private async saveDomain(domain: SiteDomain, expectedVersion: number): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.domains.save(domain, expectedVersion);
      if (
        domain.status === SITE_DOMAIN_STATUS.VERIFYING ||
        domain.status === SITE_DOMAIN_STATUS.ACTIVE
      ) {
        return;
      }
      await this.dependencies.events.publish(
        WEBSITE_EVENT_TYPE.DOMAIN_STATE_CHANGED,
        { siteDomainId: domain.siteDomainId, operationGeneration: domain.operationGeneration },
        { orderingKey: `website:${domain.organizationId}` },
      );
    });
  }

  private async clearCanonicalIfMatch(domain: SiteDomain, now: Date): Promise<void> {
    const site = await this.dependencies.sites.findCurrent();
    if (site === undefined || site.canonicalSiteDomainId !== domain.siteDomainId) return;
    await this.dependencies.sites.save(
      site.clearCanonical({ now, actorUserId: null }),
      site.version,
    );
  }
}

function later(now: Date, delayMs: number): Date {
  return new Date(now.getTime() + delayMs);
}

function isFullyActive(inspect: {
  readonly hostnameActive: boolean;
  readonly certificateActive: boolean;
  readonly dnsTargetsService: boolean;
}): boolean {
  return inspect.hostnameActive && inspect.certificateActive && inspect.dnsTargetsService;
}

export function buildReconcileDomainsJob(input: {
  readonly useCase: ProcessDueSiteDomainsUseCase;
}): ScheduledJob {
  return {
    jobKey: "website.reconcileDomains",
    everyMinutes: 5,
    moduleKey: MODULE_KEY.WEBSITE,
    run: async (_organizationId, now) => {
      await input.useCase.execute(now);
    },
  };
}
