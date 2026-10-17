import type { OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import { viewOrganization, type ProfileView } from "../custom-field-view.js";
import type {
  OrganizationCustomFieldReader,
  SensitiveValueAccess,
} from "../ports/custom-field-ports.js";
import type { OrganizationProfileRepository } from "../ports/organization-profile-repository.js";

export interface GetProfileDependencies {
  readonly organizations: OrganizationProfileRepository;
  readonly customFields: OrganizationCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
}

/** The business profile of the active organization. Any active member may read it (plan 1.7b decision 3). */
export class GetProfileUseCase {
  constructor(private readonly dependencies: GetProfileDependencies) {}

  async execute(input: { readonly organizationId: OrganizationId }): Promise<ProfileView> {
    const { organizations, customFields, sensitiveAccess } = this.dependencies;
    const organization = await organizations.findById(input.organizationId);
    if (organization === undefined) throw recordNotFound();
    const fields = await customFields.forEntity(input.organizationId, "organization");
    return viewOrganization(sensitiveAccess, organization, fields);
  }
}
