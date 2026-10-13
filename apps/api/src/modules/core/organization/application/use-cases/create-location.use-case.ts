import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  LIMIT_KEY,
  ORGANIZATION_EVENT_TYPE,
  type LocationType,
  type PostalAddress,
} from "@banijjik/contracts";
import type { LimitGuard } from "../../../../../kernel/access/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { Location } from "../../domain/location.entity.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import type { OrganizationLimitLock } from "../ports/organization-limit-lock.js";
import type { ActorInput } from "./location-actor-input.js";
import type { LocationDependencies } from "./location-dependencies.js";
import { auditFieldsOf } from "./location-audit-fields.js";

export interface CreateLocationInput extends ActorInput {
  readonly name: string;
  readonly locationType: LocationType;
  readonly address?: PostalAddress;
  readonly phoneE164?: string;
  readonly timezone?: string;
}

export interface CreateLocationDependencies extends LocationDependencies {
  readonly configVersion: ConfigVersionBumper;
  readonly limits: LimitGuard;
  readonly limitLock: OrganizationLimitLock;
  readonly clock: Clock;
}

/** Adds a location. The limit `locations` counts ACTIVE locations; the name is unique among them. */
export class CreateLocationUseCase {
  constructor(private readonly dependencies: CreateLocationDependencies) {}

  execute(input: CreateLocationInput): Promise<Location> {
    const { locations, limits, limitLock, unitOfWork, events, audit, clock } = this.dependencies;
    const { configVersion } = this.dependencies;
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
      // The menu shows "Locations" from the second active location, so the cached config must be rebuilt.
      await configVersion.bump(input.organizationId);
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
