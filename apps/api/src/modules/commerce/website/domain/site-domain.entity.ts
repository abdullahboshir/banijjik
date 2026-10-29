import { ERROR_CODE } from "@banijjik/contracts";
import {
  SITE_DOMAIN_STATUS,
  type DnsInstruction,
  type SiteDomainStatus,
} from "@banijjik/contracts/website";
import type { OrganizationId, SiteDomainId, SiteId, UserId } from "@banijjik/ids";
import { DomainRuleError } from "./errors.js";

export interface SiteDomainProps {
  readonly siteDomainId: SiteDomainId;
  readonly organizationId: OrganizationId;
  readonly siteId: SiteId;
  readonly hostname: string;
  readonly status: SiteDomainStatus;
  readonly providerHostnameId: string | null;
  readonly operationGeneration: number;
  readonly nextAttemptAt: Date;
  readonly lastVerifiedAt: Date | null;
  readonly ownershipRecords: readonly DnsInstruction[];
  readonly certificateRecords: readonly DnsInstruction[];
  readonly safeDiagnosticKey: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface CreateSiteDomainInput {
  readonly siteDomainId: SiteDomainId;
  readonly organizationId: OrganizationId;
  readonly siteId: SiteId;
  readonly hostname: string;
  readonly now: Date;
  readonly actorUserId: UserId | null;
}

const FIRST_GENERATION = 1;
const REMOVAL_BLOCKED = new Set<SiteDomainStatus>([
  SITE_DOMAIN_STATUS.REMOVING,
  SITE_DOMAIN_STATUS.REMOVED,
]);
const VERIFICATION_BLOCKED = new Set<SiteDomainStatus>([
  SITE_DOMAIN_STATUS.ACTIVE,
  SITE_DOMAIN_STATUS.SUSPENDED,
  SITE_DOMAIN_STATUS.REMOVING,
  SITE_DOMAIN_STATUS.REMOVED,
]);

function notReady(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.WEBSITE_DOMAIN_NOT_READY });
}

/**
 * One tenant-owned custom hostname (card 4.2 A2). Canonical selection lives on Site, never here.
 * Status moves to ACTIVE only when A3's worker has seen the provider; this entity never talks to it.
 */
export class SiteDomain {
  private constructor(private readonly props: SiteDomainProps) {}

  static create(input: CreateSiteDomainInput): SiteDomain {
    return new SiteDomain({
      siteDomainId: input.siteDomainId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      hostname: input.hostname,
      status: SITE_DOMAIN_STATUS.PENDING,
      providerHostnameId: null,
      operationGeneration: FIRST_GENERATION,
      nextAttemptAt: input.now,
      lastVerifiedAt: null,
      ownershipRecords: [],
      certificateRecords: [],
      safeDiagnosticKey: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: SiteDomainProps): SiteDomain {
    return new SiteDomain(props);
  }

  get siteDomainId(): SiteDomainId {
    return this.props.siteDomainId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get siteId(): SiteId {
    return this.props.siteId;
  }

  get hostname(): string {
    return this.props.hostname;
  }

  get status(): SiteDomainStatus {
    return this.props.status;
  }

  get providerHostnameId(): string | null {
    return this.props.providerHostnameId;
  }

  get operationGeneration(): number {
    return this.props.operationGeneration;
  }

  get nextAttemptAt(): Date {
    return this.props.nextAttemptAt;
  }

  get lastVerifiedAt(): Date | null {
    return this.props.lastVerifiedAt;
  }

  get ownershipRecords(): readonly DnsInstruction[] {
    return this.props.ownershipRecords;
  }

  get certificateRecords(): readonly DnsInstruction[] {
    return this.props.certificateRecords;
  }

  get safeDiagnosticKey(): string | null {
    return this.props.safeDiagnosticKey;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  /**
   * Enqueue verification (A3 consumes the outbox). Generation stays at the create-time value so A1
   * `disable` still matches the reserved claim; A3 bumps it when it retries the same domain.
   */
  requestVerification(input: {
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): SiteDomain {
    if (VERIFICATION_BLOCKED.has(this.props.status)) throw notReady();
    return this.withStatus({
      status: SITE_DOMAIN_STATUS.VERIFYING,
      now: input.now,
      actorUserId: input.actorUserId,
    });
  }

  requestRemoval(input: { readonly now: Date; readonly actorUserId: UserId | null }): SiteDomain {
    if (REMOVAL_BLOCKED.has(this.props.status)) throw notReady();
    return this.withStatus({
      status: SITE_DOMAIN_STATUS.REMOVING,
      now: input.now,
      actorUserId: input.actorUserId,
    });
  }

  recordProvider(input: {
    readonly providerHostnameId: string;
    readonly ownershipRecords: readonly DnsInstruction[];
    readonly certificateRecords: readonly DnsInstruction[];
    readonly diagnosticKey: string | null;
    readonly now: Date;
  }): SiteDomain {
    return new SiteDomain({
      ...this.props,
      providerHostnameId: input.providerHostnameId,
      ownershipRecords: input.ownershipRecords,
      certificateRecords: input.certificateRecords,
      safeDiagnosticKey: input.diagnosticKey,
      version: this.props.version + 1,
      updatedAt: input.now,
    });
  }

  activate(input: { readonly now: Date; readonly nextAttemptAt: Date }): SiteDomain {
    if (this.props.status !== SITE_DOMAIN_STATUS.VERIFYING) throw notReady();
    return this.withStatus({
      status: SITE_DOMAIN_STATUS.ACTIVE,
      now: input.now,
      nextAttemptAt: input.nextAttemptAt,
      lastVerifiedAt: input.now,
    });
  }

  suspend(input: { readonly now: Date; readonly diagnosticKey: string | null }): SiteDomain {
    if (this.props.status !== SITE_DOMAIN_STATUS.ACTIVE) throw notReady();
    return this.withStatus({
      status: SITE_DOMAIN_STATUS.SUSPENDED,
      now: input.now,
      diagnosticKey: input.diagnosticKey,
    });
  }

  recoverToVerifying(input: { readonly now: Date }): SiteDomain {
    if (this.props.status !== SITE_DOMAIN_STATUS.SUSPENDED) throw notReady();
    return this.withStatus({ status: SITE_DOMAIN_STATUS.VERIFYING, now: input.now });
  }

  fail(input: { readonly now: Date; readonly diagnosticKey: string | null }): SiteDomain {
    if (this.props.status !== SITE_DOMAIN_STATUS.VERIFYING) throw notReady();
    return this.withStatus({
      status: SITE_DOMAIN_STATUS.FAILED,
      now: input.now,
      diagnosticKey: input.diagnosticKey,
    });
  }

  markRemoved(input: { readonly now: Date }): SiteDomain {
    if (this.props.status !== SITE_DOMAIN_STATUS.REMOVING) throw notReady();
    return this.withStatus({ status: SITE_DOMAIN_STATUS.REMOVED, now: input.now });
  }

  scheduleRetry(input: { readonly nextAttemptAt: Date; readonly now: Date }): SiteDomain {
    return new SiteDomain({
      ...this.props,
      nextAttemptAt: input.nextAttemptAt,
      version: this.props.version + 1,
      updatedAt: input.now,
    });
  }

  /**
   * Status and CAS token move; generation stays so `hostClaims.disable` still matches the claim
   * that `reserve` wrote (A1 equality). A3 bumps generation when it retries the same domain.
   */
  private withStatus(input: {
    readonly status: SiteDomainStatus;
    readonly now: Date;
    readonly actorUserId?: UserId | null;
    readonly nextAttemptAt?: Date;
    readonly lastVerifiedAt?: Date;
    readonly diagnosticKey?: string | null;
  }): SiteDomain {
    return new SiteDomain({
      ...this.props,
      status: input.status,
      nextAttemptAt: input.nextAttemptAt ?? input.now,
      ...(input.lastVerifiedAt === undefined ? {} : { lastVerifiedAt: input.lastVerifiedAt }),
      ...(input.diagnosticKey === undefined ? {} : { safeDiagnosticKey: input.diagnosticKey }),
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId ?? this.props.updatedByUserId,
    });
  }
}
