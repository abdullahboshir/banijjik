import { OrganizationMembership } from "@iam/domain";
export interface IOrganizationMembershipRepository {
    save(membership: OrganizationMembership): Promise<OrganizationMembership>;
    findById(organizationMembershipId: string): Promise<OrganizationMembership | null>;
    findByUserAndOrg(userId: string, organizationId: string): Promise<OrganizationMembership[]>;
    findByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
    delete(organizationMembershipId: string): Promise<void>;
}
//# sourceMappingURL=organization-membership.repository.d.ts.map