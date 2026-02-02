import { CommonStatusType } from "@banijjik/contracts";
export declare class OrganizationMembershipVO {
    private readonly role;
    private readonly organization;
    private readonly status;
    constructor(role: string, organization: string, status: CommonStatusType);
    static create(props: {
        role: string;
        organization: string;
        status: CommonStatusType;
    }): OrganizationMembershipVO;
    getRole(): string;
    getOrganization(): string;
    getStatus(): CommonStatusType;
    toObject(): {
        role: string;
        organization: string;
        status: "ACTIVE" | "INACTIVE";
    };
}
//# sourceMappingURL=organization-membership.vo.d.ts.map