export class Organization {
    constructor(props) {
        this.props = {
            ...props,
            id: props.id ?? crypto.randomUUID(),
            status: props.status || "PENDING",
            nature: props.nature || "SERVICE",
            establishedDate: props.establishedDate || new Date(),
            metadata: props.metadata || {},
            createdAt: props.createdAt || new Date(),
            updatedAt: props.updatedAt || new Date(),
        };
    }
    get _id() {
        return this.props._id;
    }
    get id() {
        return this.props.id;
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
    get metadata() {
        return this.props.metadata;
    }
    update(props) {
        this.props = {
            ...this.props,
            ...props,
            updatedAt: new Date(),
        };
    }
    toJSON() {
        return { ...this.props };
    }
}
//# sourceMappingURL=organization.entity.js.map