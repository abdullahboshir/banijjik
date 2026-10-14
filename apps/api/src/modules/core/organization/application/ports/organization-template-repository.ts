import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Organization } from "../../domain/organization.entity.js";

/** Reads an organization and saves a new industry template key. */
export interface OrganizationTemplateRepository {
  findById(organizationId: OrganizationId): Promise<Organization | undefined>;
  updateIndustryTemplate(
    organization: Organization,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Organization>;
}
