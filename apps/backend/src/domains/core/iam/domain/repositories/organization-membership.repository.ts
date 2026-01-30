import { OrganizationMembership } from "@iam/domain";

export interface IOrganizationMembershipRepository {
  save(membership: OrganizationMembership): Promise<void>;
  findById(id: string): Promise<OrganizationMembership | null>;
  findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership[]>;
  findByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
  delete(id: string): Promise<void>;
}
