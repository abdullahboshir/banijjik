export class Permission {
    constructor(props) {
        this.props = props;
    }
    get id() {
        return this.props.id;
    }
    get name() {
        return this.props.name;
    }
    get key() {
        return this.props.key;
    }
    get module() {
        return this.props.module;
    }
    toObject() {
        return { ...this.props };
    }
    static create(props) {
        return new Permission(props);
    }
}
//# sourceMappingURL=permission.entity.js.map