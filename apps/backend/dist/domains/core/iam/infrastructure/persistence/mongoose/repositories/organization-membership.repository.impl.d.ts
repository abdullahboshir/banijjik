import { IOrganizationMembershipRepository, OrganizationMembership } from "@iam/domain";
export declare class MongooseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
    save(membership: OrganizationMembership): Promise<OrganizationMembership>;
    findById(organizationMembershipId: string): Promise<OrganizationMembership | null>;
    findByUserAndOrg(userId: string, organizationId: string): Promise<OrganizationMembership[]>;
    findByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
    delete(organizationMembershipId: string): Promise<void>;
}
//# sourceMappingURL=organization-membership.repository.impl.d.ts.map