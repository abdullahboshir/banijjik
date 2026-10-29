import {
  asId,
  newId,
  type HostClaimId,
  type OrganizationId,
  type SiteDomainId,
} from "@banijjik/ids";
import type { UserId } from "@banijjik/ids";
import {
  HostClaimGenerationMismatchError,
  HostClaimQuarantinedError,
  HostClaimTakenError,
} from "./errors.js";

/** How long a removed host stays unreclaimable while the provider deletion is reconciled (plan 4.2 decision 8). */
export const HOST_CLAIM_QUARANTINE_MS = 24 * 60 * 60 * 1000;

export interface HostClaimProps {
  readonly hostClaimId: HostClaimId;
  readonly hostname: string;
  readonly organizationId: OrganizationId;
  readonly siteDomainId: SiteDomainId;
  readonly enabled: boolean;
  /** The operation generation that owns this claim; a late job of an older one is refused (decision 6). */
  readonly generation: number;
  readonly quarantineUntil: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

/**
 * The platform's routing record for one host name (plan 4.2 decision 4). It holds no tenant data: it
 * only answers which organization a host belongs to, and which operation generation is current.
 * The row is global because a unique index per organization cannot make a host unique across them.
 */
export class HostClaim {
  private constructor(private readonly props: HostClaimProps) {}

  static create(input: {
    readonly hostname: string;
    readonly organizationId: OrganizationId;
    readonly siteDomainId: SiteDomainId;
    readonly operationGeneration: number;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): HostClaim {
    return new HostClaim({
      hostClaimId: asId<HostClaimId>(newId()),
      hostname: input.hostname,
      organizationId: input.organizationId,
      siteDomainId: input.siteDomainId,
      enabled: true,
      generation: input.operationGeneration,
      quarantineUntil: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: HostClaimProps): HostClaim {
    return new HostClaim(props);
  }

  get hostClaimId(): HostClaimId {
    return this.props.hostClaimId;
  }

  get hostname(): string {
    return this.props.hostname;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get siteDomainId(): SiteDomainId {
    return this.props.siteDomainId;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get generation(): number {
    return this.props.generation;
  }

  get quarantineUntil(): Date | null {
    return this.props.quarantineUntil;
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

  /** Only an enabled claim routes a host to its organization. */
  isRoutable(): boolean {
    return this.props.enabled;
  }

  isQuarantinedAt(now: Date): boolean {
    return (
      !this.props.enabled && this.props.quarantineUntil !== null && this.props.quarantineUntil > now
    );
  }

  /** An explicit retry of the same site domain: the new generation takes ownership of the claim. */
  withGeneration(input: {
    readonly operationGeneration: number;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): HostClaim {
    return new HostClaim({
      ...this.props,
      generation: input.operationGeneration,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  /**
   * Removal stops routing at once and starts the quarantine. A job of another generation is refused,
   * so a late worker cannot disable a claim that a newer operation already owns.
   */
  disable(input: {
    readonly operationGeneration: number;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): HostClaim {
    if (this.props.generation !== input.operationGeneration) {
      throw new HostClaimGenerationMismatchError(this.props.hostname, input.operationGeneration);
    }
    if (!this.props.enabled) return this;
    return new HostClaim({
      ...this.props,
      enabled: false,
      quarantineUntil: new Date(input.now.getTime() + HOST_CLAIM_QUARANTINE_MS),
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  /** A host nobody holds, or one whose quarantine has lapsed, moves to a new owner and generation. */
  reclaim(input: {
    readonly organizationId: OrganizationId;
    readonly siteDomainId: SiteDomainId;
    readonly operationGeneration: number;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): HostClaim {
    if (this.props.enabled) throw new HostClaimTakenError(this.props.hostname);
    if (this.isQuarantinedAt(input.now)) {
      throw new HostClaimQuarantinedError(
        this.props.hostname,
        this.props.quarantineUntil ?? input.now,
      );
    }
    return new HostClaim({
      ...this.props,
      organizationId: input.organizationId,
      siteDomainId: input.siteDomainId,
      enabled: true,
      generation: input.operationGeneration,
      quarantineUntil: null,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }
}
