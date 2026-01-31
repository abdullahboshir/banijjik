import { OrganizationMembership } from "@iam/domain";
import { IOrganizationMembershipDoc } from "../models/organization-membership.model";
export declare class OrganizationMembershipMapper {
    static toDomain(doc: IOrganizationMembershipDoc): OrganizationMembership;
    static toPersistence(domain: OrganizationMembership): any;
}
//# sourceMappingURL=organization-membership.mapper.d.ts.map