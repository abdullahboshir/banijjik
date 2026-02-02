export class Organization {
    constructor(props) {
        this.props = {
            ...props,
            organizationId: props.organizationId ?? crypto.randomUUID(),
            establishedDate: props.establishedDate || new Date(),
            metadata: props.metadata || {},
            createdAt: props.createdAt || new Date(),
            updatedAt: props.updatedAt || new Date(),
        };
    }
    get organizationId() {
        return this.props.organizationId;
    }
    get name() {
        return this.props.name;
    }
    get slug() {
        return this.props.slug;
    }
    get industry() {
        return this.props.industry;
    }
    get legalType() {
        return this.props.legalType;
    }
    get nature() {
        return this.props.nature;
    }
    get status() {
        return this.props.status;
    }
    get deployment() {
        return this.props.deployment;
    }
    get localization() {
        return this.props.localization;
    }
    get metadata() {
        return this.props.metadata;
    }
    get email() {
        return this.props.email;
    }
    get phone() {
        return this.props.phone;
    }
    get supportPhone() {
        return this.props.supportPhone;
    }
    get establishedDate() {
        return this.props.establishedDate;
    }
    get address() {
        return this.props.address;
    }
    get website() {
        return this.props.website;
    }
    update(props) {
        this.props = {
            ...this.props,
            ...props,
            updatedAt: new Date(),
        };
    }
    toJSON() {
        return {
            ...this.props,
            industry: this.props.industry.getValue(),
            legalType: this.props.legalType.getValue(),
            nature: this.props.nature.getValue(),
            status: this.props.status.getValue(),
            localization: this.props.localization.toValue(),
            deployment: this.props.deployment.toValue(),
        };
    }
}
//# sourceMappingURL=organization.entity.js.map