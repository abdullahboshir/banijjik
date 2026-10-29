import {
  asId,
  type HostClaimId,
  type OrganizationId,
  type SiteDomainId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type {
  DisableHostClaimInput,
  HostClaimResolution,
  HostClaims,
  ReserveHostClaimInput,
} from "../application/host-claims.js";
import { HostClaim } from "../domain/host-claim.entity.js";
import {
  HostClaimGenerationMismatchError,
  HostClaimTakenError,
  invalidHostname,
  reservedHostname,
} from "../domain/errors.js";
import {
  isReservedHostname,
  normalizeHostname,
  type HostnameReservations,
} from "../application/hostname.js";
import { HOST_CLAIM_MODEL_NAME, type HostClaimDocument } from "./host-claim.schema.js";

/** One reserve call, normalized once so the writer and the claim agree on the host and the time. */
interface ReservationRequest {
  readonly hostname: string;
  readonly organizationId: OrganizationId;
  readonly siteDomainId: SiteDomainId;
  readonly operationGeneration: number;
  readonly actorUserId: UserId | null;
  readonly now: Date;
}

function hostClaimModel(): Model<HostClaimDocument> {
  return models({}).get<HostClaimDocument>(HOST_CLAIM_MODEL_NAME);
}

function toHostClaim(row: HostClaimDocument): HostClaim {
  return HostClaim.rehydrate({
    hostClaimId: asId<HostClaimId>(row.hostClaimId),
    hostname: row.hostname,
    organizationId: asId<OrganizationId>(row.organizationId),
    siteDomainId: asId<SiteDomainId>(row.siteDomainId),
    enabled: row.enabled,
    generation: row.generation,
    quarantineUntil: row.quarantineUntil,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

function toHostClaimDocument(claim: HostClaim): HostClaimDocument {
  return {
    hostClaimId: claim.hostClaimId,
    hostname: claim.hostname,
    organizationId: claim.organizationId,
    siteDomainId: claim.siteDomainId,
    enabled: claim.enabled,
    generation: claim.generation,
    quarantineUntil: claim.quarantineUntil,
    version: claim.version,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    createdByUserId: claim.createdByUserId,
    updatedByUserId: claim.updatedByUserId,
  };
}

/**
 * The platform registry of host names (plan 4.2 decision 4). It resolves routing from its own record
 * only; it never reads a tenant collection and never calls the domain provider.
 */
export class MongoHostClaims implements HostClaims {
  constructor(private readonly reservations: HostnameReservations) {}

  async reserve(input: ReserveHostClaimInput): Promise<void> {
    const hostname = normalizeHostname(input.hostname);
    if (hostname === undefined) throw invalidHostname(input.hostname);
    if (isReservedHostname(hostname, this.reservations)) throw reservedHostname(hostname);

    const request: ReservationRequest = {
      hostname,
      organizationId: input.organizationId,
      siteDomainId: input.siteDomainId,
      operationGeneration: input.operationGeneration,
      actorUserId: input.actorUserId ?? null,
      now: new Date(),
    };
    const existing = await hostClaimModel().findOne({ hostname }).lean<HostClaimDocument>();
    if (existing !== null) {
      await this.applyToExisting(existing, request);
      return;
    }

    const claim = HostClaim.create({
      hostname,
      organizationId: request.organizationId,
      siteDomainId: request.siteDomainId,
      operationGeneration: request.operationGeneration,
      now: request.now,
      actorUserId: request.actorUserId,
    });
    try {
      await hostClaimModel().create(
        [toHostClaimDocument(claim)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      if (!isDuplicateKeyError(error, "hostname")) throw error;
      // Another reservation reached the unique index first: read the winner and decide from it.
      const winner = await hostClaimModel().findOne({ hostname }).lean<HostClaimDocument>();
      if (winner === null) throw error;
      await this.applyToExisting(winner, request);
    }
  }

  async disable(input: DisableHostClaimInput): Promise<void> {
    // The claim of another site domain is never touched: removal names the site domain it removes.
    const existing = await hostClaimModel()
      .findOne({ siteDomainId: input.siteDomainId })
      .lean<HostClaimDocument>();
    if (existing === null) return;
    const claim = toHostClaim(existing);
    const disabled = claim.disable({
      operationGeneration: input.operationGeneration,
      now: new Date(),
      actorUserId: input.actorUserId ?? null,
    });
    if (disabled === claim) return;
    if (!(await this.applyUpdate(claim, disabled))) {
      throw new HostClaimGenerationMismatchError(claim.hostname, input.operationGeneration);
    }
  }

  async resolve(hostname: string): Promise<HostClaimResolution | undefined> {
    const normalized = normalizeHostname(hostname);
    if (normalized === undefined) return undefined;
    const row = await hostClaimModel()
      .findOne(
        { hostname: normalized, enabled: true },
        { organizationId: 1, hostname: 1, generation: 1 },
      )
      .lean<Pick<HostClaimDocument, "organizationId" | "hostname" | "generation">>();
    if (row === null) return undefined;
    return {
      organizationId: asId<OrganizationId>(row.organizationId),
      hostname: row.hostname,
      domainGeneration: row.generation,
    };
  }

  private async applyToExisting(
    existing: HostClaimDocument,
    request: ReservationRequest,
  ): Promise<void> {
    const claim = toHostClaim(existing);
    if (claim.enabled) {
      const holdsSameDomain =
        claim.organizationId === request.organizationId &&
        claim.siteDomainId === request.siteDomainId;
      if (!holdsSameDomain) throw new HostClaimTakenError(request.hostname);
      if (claim.generation === request.operationGeneration) return;
      // Generations only move forward: a late request must not take a newer claim back.
      if (claim.generation > request.operationGeneration) {
        throw new HostClaimGenerationMismatchError(request.hostname, request.operationGeneration);
      }
      const next = claim.withGeneration({
        operationGeneration: request.operationGeneration,
        now: request.now,
        actorUserId: request.actorUserId,
      });
      if (!(await this.applyUpdate(claim, next))) throw new HostClaimTakenError(request.hostname);
      return;
    }
    // A removed host waits out its quarantine; after it, a fresh ownership proof may claim it again.
    const reclaimed = claim.reclaim({
      organizationId: request.organizationId,
      siteDomainId: request.siteDomainId,
      operationGeneration: request.operationGeneration,
      now: request.now,
      actorUserId: request.actorUserId,
    });
    if (!(await this.applyUpdate(claim, reclaimed))) {
      throw new HostClaimTakenError(request.hostname);
    }
  }

  /** Version-guarded write: false when another writer changed the row first. */
  private async applyUpdate(previous: HostClaim, next: HostClaim): Promise<boolean> {
    const updated = await hostClaimModel()
      .findOneAndUpdate(
        { hostClaimId: previous.hostClaimId, version: previous.version },
        {
          $set: {
            organizationId: next.organizationId,
            siteDomainId: next.siteDomainId,
            enabled: next.enabled,
            generation: next.generation,
            quarantineUntil: next.quarantineUntil,
            updatedAt: next.updatedAt,
            updatedByUserId: next.updatedByUserId,
          },
          $inc: { version: 1 },
        },
        {
          returnDocument: "after",
          runValidators: true,
          ...sessionOption(getActiveSession()),
        },
      )
      .lean<HostClaimDocument>();
    return updated !== null;
  }
}

/** The production registry; the caller supplies the platform reservations from configuration. */
export function createMongoHostClaims(reservations: HostnameReservations): HostClaims {
  return new MongoHostClaims(reservations);
}
