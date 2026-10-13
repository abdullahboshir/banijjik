import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Organization } from "../../domain/organization.entity.js";

/** Reads and saves the business profile. Organizations are platform data: no tenant filter exists. */
export interface OrganizationProfileRepository {
  findById(organizationId: OrganizationId): Promise<Organization | undefined>;
  /** Saves name, locale and profile if the stored version is still `expectedVersion`, else a 409. */
  update(
    organization: Organization,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Organization>;
}
