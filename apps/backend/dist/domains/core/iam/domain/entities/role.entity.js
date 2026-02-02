export class Role {
    constructor(props) {
        this.props = props;
    }
    get roleId() {
        return this.props.roleId;
    }
    get name() {
        return this.props.name;
    }
    get key() {
        return this.props.key;
    }
    get organizationId() {
        return this.props.organizationId;
    }
    get permissions() {
        return this.props.permissions;
    }
    get isSystem() {
        return this.props.isSystem;
    }
    toObject() {
        return { ...this.props };
    }
    static create(props) {
        return new Role({
            ...props,
            roleId: props.roleId ?? crypto.randomUUID(),
        });
    }
}
//# sourceMappingURL=role.entity.js.map