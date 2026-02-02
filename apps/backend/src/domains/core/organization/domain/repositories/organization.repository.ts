import { Organization } from "../entities/organization.entity";

export interface IOrganizationRepository {
  save(organization: Organization): Promise<Organization>;
  findById(organizationId: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
}
