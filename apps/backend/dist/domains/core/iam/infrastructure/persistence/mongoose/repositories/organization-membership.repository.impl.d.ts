import { IOrganizationMembershipRepository, OrganizationMembership } from "@iam/domain";
export declare class MongooseOrganizationMembershipRepository implements IOrganizationMembershipRepository {
    save(membership: OrganizationMembership): Promise<void>;
    findById(id: string): Promise<OrganizationMembership | null>;
    findByUserAndOrg(userId: string, organizationId: string): Promise<OrganizationMembership[]>;
    findByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=organization-membership.repository.impl.d.ts.map