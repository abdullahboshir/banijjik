export class OrganizationMembershipVO {
    constructor(role, organization, status) {
        this.role = role;
        this.organization = organization;
        this.status = status;
    }
    static create(props) {
        if (!props.role || !props.organization) {
            throw new Error("OrganizationMembershipVO requires role and organization");
        }
        return new OrganizationMembershipVO(props.role, props.organization, props.status);
    }
    getRole() {
        return this.role;
    }
    getOrganization() {
        return this.organization;
    }
    getStatus() {
        return this.status;
    }
    toObject() {
        return {
            role: this.role,
            organization: this.organization,
            status: this.status,
        };
    }
}
//# sourceMappingURL=organization-membership.vo.js.map