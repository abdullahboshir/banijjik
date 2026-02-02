import { USER_STATUS_ENUM } from "@banijjik/contracts";
export class UserStatus {
    constructor(value) {
        this.value = value;
    }
    // Friendly API
    static get VALUE() {
        return this.registry;
    }
    // O(1) Factory
    static from(value) {
        const key = value.toUpperCase();
        const status = this.registry[key];
        if (!status) {
            throw new Error(`Invalid UserStatus: ${value}`);
        }
        return status;
    }
    static all() {
        return Object.values(this.registry);
    }
    getValue() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
// Registry
UserStatus.registry = (() => {
    const map = {};
    for (const status of USER_STATUS_ENUM) {
        map[status] = new UserStatus(status);
    }
    return map;
})();
//# sourceMappingURL=user-status.vo.js.map