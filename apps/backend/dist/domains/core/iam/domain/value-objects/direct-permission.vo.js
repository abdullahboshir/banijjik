export class DirectPermission {
    constructor(permissionId, effect) {
        this.permissionId = permissionId;
        this.effect = effect;
    }
    static create(props) {
        if (!props.permissionId) {
            throw new Error("Permission ID required");
        }
        return new DirectPermission(props.permissionId, props.effect);
    }
    toObject() {
        return {
            permissionId: this.permissionId,
            effect: this.effect,
        };
    }
}
//# sourceMappingURL=direct-permission.vo.js.map