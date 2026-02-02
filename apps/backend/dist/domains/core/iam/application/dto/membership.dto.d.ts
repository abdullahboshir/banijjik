import { CommonStatusType, MembershipType, MembershipSourceType } from "@banijjik/contracts";
export interface CreateOrganizationMembershipDto {
    userId: string;
    organizationId: string;
    roleId: string;
    type: MembershipType;
    status: CommonStatusType;
    source: MembershipSourceType;
    designation?: string;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=membership.dto.d.ts.map