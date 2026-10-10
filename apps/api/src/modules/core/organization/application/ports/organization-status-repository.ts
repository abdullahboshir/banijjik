import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Organization } from "../../domain/organization.entity.js";

/** Reads and saves the status of an organization. Organizations are platform data: no tenant filter exists. */
export interface OrganizationStatusRepository {
  findById(organizationId: OrganizationId): Promise<Organization | undefined>;
  /** Saves the status if the stored version is still `expectedVersion`, else a 409. */
  updateStatus(
    organization: Organization,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Organization>;
}
