export class OrganizationMembership {
    constructor(props) {
        this.props = props;
    }
    get _id() {
        return this.props.membershipId;
    }
    get membershipId() {
        return this.props.membershipId;
    }
    get userId() {
        return this.props.userId;
    }
    get organizationId() {
        return this.props.organizationId;
    }
    get roleId() {
        return this.props.roleId;
    }
    get type() {
        return this.props.type;
    }
    get designation() {
        return this.props.designation;
    }
    get memberCode() {
        return this.props.memberCode;
    }
    get status() {
        return this.props.status;
    }
    get source() {
        return this.props.source;
    }
    get joinedAt() {
        return this.props.joinedAt;
    }
    toObject() {
        return { ...this.props };
    }
    updateMetadata(key, value) {
        if (!this.props.metadata)
            this.props.metadata = {};
        this.props.metadata[key] = value;
        this.props.updatedAt = new Date();
    }
    updateDesignation(designation) {
        this.props.designation = designation;
        this.props.updatedAt = new Date();
    }
    static create(props) {
        return new OrganizationMembership({
            ...props,
            membershipId: props.membershipId ?? crypto.randomUUID(),
            updatedAt: props.updatedAt ?? new Date(),
        });
    }
}
//# sourceMappingURL=organization-membership.entity.js.map