import { WEBSITE_EVENT_TYPE, type DomainEventPayload } from "@banijjik/contracts/website";
import type { SiteDomainId } from "@banijjik/ids";
import type { SiteDomain } from "../../domain/site-domain.entity.js";

export interface SiteDomainRepository {
  insert(domain: SiteDomain): Promise<"inserted" | "duplicate">;
  findById(siteDomainId: SiteDomainId): Promise<SiteDomain | undefined>;
  save(domain: SiteDomain, expectedVersion: number): Promise<void>;
  listPage(input: {
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly SiteDomain[]; readonly total: number }>;
  listDuePage(input: {
    readonly now: Date;
    readonly afterSiteDomainId?: SiteDomainId;
    readonly limit: number;
  }): Promise<readonly SiteDomain[]>;
}

export interface SiteDomainUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export type SiteDomainEventType =
  | typeof WEBSITE_EVENT_TYPE.DOMAIN_REQUESTED
  | typeof WEBSITE_EVENT_TYPE.DOMAIN_VERIFICATION_REQUESTED
  | typeof WEBSITE_EVENT_TYPE.DOMAIN_REMOVAL_REQUESTED
  | typeof WEBSITE_EVENT_TYPE.DOMAIN_STATE_CHANGED;

export interface SiteDomainEventPublisher {
  publish(
    type: SiteDomainEventType,
    payload: DomainEventPayload,
    options: { readonly orderingKey: string },
  ): Promise<void>;
}
