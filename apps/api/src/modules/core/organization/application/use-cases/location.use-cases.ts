import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  LIMIT_KEY,
  ORGANIZATION_EVENT_TYPE,
  type LocationStatus,
  type LocationType,
  type PostalAddress,
} from "@banijjik/contracts";
import type { LocationId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { LimitGuard } from "../../../../../kernel/access/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { locationInUse, recordNotFound } from "../../domain/errors.js";
import { Location, type LocationChanges } from "../../domain/location.entity.js";
import { diffAuditFields, type AuditFields } from "../audit-diff.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type {
  InvitationRepository,
  MemberManagementRepository,
} from "../ports/member-and-invitation-repositories.js";
import type {
  LocationManagementRepository,
  OrganizationLimitLock,
  Page,
  PageRequest,
} from "../ports/profile-and-location-repositories.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

interface LocationDependencies {
  readonly locations: LocationManagementRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
}

interface ActorInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

function auditFieldsOf(location: Location): AuditFields {
  return {
    name: location.name,
    locationType: location.locationType,
    status: location.status,
    phoneE164: location.phoneE164,
    timezone: location.timezone,
    "address.line1": location.address?.line1,
    "address.area": location.address?.area,
    "address.thana": location.address?.thana,
    "address.district": location.address?.district,
    "address.postalCode": location.address?.postalCode,
  };
}

export interface ListLocationsInput extends PageRequest {
  readonly status?: LocationStatus;
  readonly visibleLocationIds: readonly string[] | "ALL";
}

/** One page of locations. A caller limited to some locations sees only those (plan 1.7b decision 5). */
export class ListLocationsUseCase {
  constructor(private readonly locations: LocationManagementRepository) {}

  execute(input: ListLocationsInput): Promise<Page<Location>> {
    return this.locations.list(input);
  }
}

export interface CreateLocationInput extends ActorInput {
  readonly name: string;
  readonly locationType: LocationType;
  readonly address?: PostalAddress;
  readonly phoneE164?: string;
  readonly timezone?: string;
}

export interface CreateLocationDependencies extends LocationDependencies {
  readonly limits: LimitGuard;
  readonly limitLock: OrganizationLimitLock;
  readonly clock: Clock;
}

/** Adds a location. The limit `locations` counts ACTIVE locations; the name is unique among them. */
export class CreateLocationUseCase {
  constructor(private readonly dependencies: CreateLocationDependencies) {}

  execute(input: CreateLocationInput): Promise<Location> {
    const { locations, limits, limitLock, unitOfWork, events, audit, clock } = this.dependencies;
    const location = Location.create({
      organizationId: input.organizationId,
      name: input.name,
      locationType: input.locationType,
      address: input.address,
      phoneE164: input.phoneE164,
      timezone: input.timezone,
      createdByUserId: input.actorUserId,
      now: clock.now(),
    });
    return unitOfWork.run(async () => {
      await limitLock.acquire(input.organizationId);
      await limits.assertBelow(LIMIT_KEY.LOCATIONS, await locations.countActive());
      await locations.insert(location);
      await audit.record({
        action: AUDIT_ACTION.LOCATION_CREATED,
        entityType: AUDIT_ENTITY_TYPE.location,
        entityId: location.locationId,
        changes: diffAuditFields({}, auditFieldsOf(location)),
      });
      await events.publish(ORGANIZATION_EVENT_TYPE.LOCATION_CREATED, {
        locationId: location.locationId,
      });
      return location;
    });
  }
}

export interface UpdateLocationInput extends ActorInput {
  readonly locationId: LocationId;
  readonly version: number;
  readonly changes: LocationChanges;
}

/** Edits a location. A stale version is a 409; an archived location cannot be edited. */
export class UpdateLocationUseCase {
  constructor(private readonly dependencies: LocationDependencies) {}

  execute(input: UpdateLocationInput): Promise<Location> {
    const { locations, unitOfWork, events, audit } = this.dependencies;
    return unitOfWork.run(async () => {
      const existing = await locations.findById(input.locationId);
      if (existing === undefined) throw recordNotFound();
      const edited = existing.withChanges(input.changes);
      const saved = await locations.update(edited, input.version, input.actorUserId);
      await audit.record({
        action: AUDIT_ACTION.LOCATION_UPDATED,
        entityType: AUDIT_ENTITY_TYPE.location,
        entityId: saved.locationId,
        changes: diffAuditFields(auditFieldsOf(existing), auditFieldsOf(saved)),
      });
      await events.publish(ORGANIZATION_EVENT_TYPE.LOCATION_UPDATED, {
        locationId: saved.locationId,
      });
      return saved;
    });
  }
}

export interface ArchiveLocationInput extends ActorInput {
  readonly locationId: LocationId;
  readonly version: number;
}

export interface ArchiveLocationDependencies extends LocationDependencies {
  readonly members: Pick<MemberManagementRepository, "existsActiveAssignedTo">;
  readonly invitations: Pick<InvitationRepository, "existsPendingNaming">;
  readonly clock: Clock;
}

/**
 * Archives a location. Refused for the default location, and while an ACTIVE member is assigned
 * to it or a pending invitation names it. The stock and open-request checks of 09 section 4.3
 * arrive with the inventory and sales cards.
 */
export class ArchiveLocationUseCase {
  constructor(private readonly dependencies: ArchiveLocationDependencies) {}

  execute(input: ArchiveLocationInput): Promise<Location> {
    const { locations, unitOfWork, events, audit } = this.dependencies;
    return unitOfWork.run(async () => {
      const existing = await locations.findById(input.locationId);
      if (existing === undefined) throw recordNotFound();
      const archived = existing.archive();
      await this.assertNotInUse(input.locationId);
      const saved = await locations.update(archived, input.version, input.actorUserId);
      await audit.record({
        action: AUDIT_ACTION.LOCATION_ARCHIVED,
        entityType: AUDIT_ENTITY_TYPE.location,
        entityId: saved.locationId,
        changes: diffAuditFields(auditFieldsOf(existing), auditFieldsOf(saved)),
      });
      await events.publish(ORGANIZATION_EVENT_TYPE.LOCATION_ARCHIVED, {
        locationId: saved.locationId,
      });
      return saved;
    });
  }

  private async assertNotInUse(locationId: LocationId): Promise<void> {
    const { members, invitations, clock } = this.dependencies;
    const isAssigned = await members.existsActiveAssignedTo(locationId);
    const isNamed = await invitations.existsPendingNaming(locationId, clock.now());
    if (isAssigned || isNamed) throw locationInUse();
  }
}
