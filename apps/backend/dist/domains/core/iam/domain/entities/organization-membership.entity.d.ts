import { CommonStatusType, MembershipType, MembershipSourceType } from "@banijjik/contracts";
export interface OrganizationMembershipProps {
    id?: string;
    userId: string;
    organizationId: string;
    roleId: string;
    type: MembershipType;
    designation?: string;
    memberCode?: string;
    status: CommonStatusType;
    source: MembershipSourceType;
    joinedAt: Date;
    updatedAt?: Date;
    metadata?: Record<string, any>;
}
export declare class OrganizationMembership {
    private readonly props;
    constructor(props: OrganizationMembershipProps);
    get id(): string | undefined;
    get userId(): string;
    get organizationId(): string;
    get roleId(): string;
    get type(): MembershipType;
    get designation(): string | undefined;
    get memberCode(): string | undefined;
    get status(): CommonStatusType;
    get source(): MembershipSourceType;
    get joinedAt(): Date;
    toObject(): {
        id?: string;
        userId: string;
        organizationId: string;
        roleId: string;
        type: MembershipType;
        designation?: string;
        memberCode?: string;
        status: CommonStatusType;
        source: MembershipSourceType;
        joinedAt: Date;
        updatedAt?: Date;
        metadata?: Record<string, any>;
    };
    updateMetadata(key: string, value: any): void;
    updateDesignation(designation: string): void;
    static create(props: OrganizationMembershipProps): OrganizationMembership;
}
//# sourceMappingURL=organization-membership.entity.d.ts.map