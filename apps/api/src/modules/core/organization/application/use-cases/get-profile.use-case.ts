import type { OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { Organization } from "../../domain/organization.entity.js";
import type { OrganizationProfileRepository } from "../ports/organization-profile-repository.js";

/** The business profile of the active organization. Any active member may read it (plan 1.7b decision 3). */
export class GetProfileUseCase {
  constructor(private readonly organizations: OrganizationProfileRepository) {}

  async execute(input: { readonly organizationId: OrganizationId }): Promise<Organization> {
    const organization = await this.organizations.findById(input.organizationId);
    if (organization === undefined) throw recordNotFound();
    return organization;
  }
}
