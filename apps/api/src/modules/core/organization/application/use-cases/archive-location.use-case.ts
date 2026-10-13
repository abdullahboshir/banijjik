import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";
import type { LocationId } from "@banijjik/ids";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { locationInUse, recordNotFound } from "../../domain/errors.js";
import { Location } from "../../domain/location.entity.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import type { InvitationRepository } from "../ports/invitation-repository.js";
import type { MemberManagementRepository } from "../ports/member-management-repository.js";
import type { ActorInput } from "./location-actor-input.js";
import type { LocationDependencies } from "./location-dependencies.js";
import { auditFieldsOf } from "./location-audit-fields.js";

export interface ArchiveLocationInput extends ActorInput {
  readonly locationId: LocationId;
  readonly version: number;
}

export interface ArchiveLocationDependencies extends LocationDependencies {
  readonly configVersion: ConfigVersionBumper;
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
      await this.dependencies.configVersion.bump(input.organizationId);
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
