export class Permission {
    constructor(props) {
        this.props = props;
    }
    get permissionId() {
        return this.props.permissionId;
    }
    get domain() {
        return this.props.domain;
    }
    get resource() {
        return this.props.resource;
    }
    get action() {
        return this.props.action;
    }
    get scope() {
        return this.props.scope;
    }
    get effect() {
        return this.props.effect;
    }
    toObject() {
        return { ...this.props };
    }
    static create(props) {
        return new Permission({
            ...props,
            permissionId: props.permissionId ?? crypto.randomUUID(),
        });
    }
}
//# sourceMappingURL=permission.entity.js.map