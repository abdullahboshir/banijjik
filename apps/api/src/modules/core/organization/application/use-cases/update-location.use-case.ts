import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";
import type { LocationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import { Location, type LocationChanges } from "../../domain/location.entity.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import type { ActorInput } from "./location-actor-input.js";
import type { LocationDependencies } from "./location-dependencies.js";
import { auditFieldsOf } from "./location-audit-fields.js";

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
