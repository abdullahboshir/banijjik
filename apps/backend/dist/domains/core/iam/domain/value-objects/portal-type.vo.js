import { PORTAL_TYPE_ENUM, } from "@banijjik/contracts";
export class PortalType {
    constructor(value) {
        this.value = value;
    }
    static get VALUE() {
        return this.registry;
    }
    static from(value) {
        const type = value.toUpperCase();
        if (!PORTAL_TYPE_ENUM.includes(type)) {
            throw new Error(`Invalid PortalType: ${value}`);
        }
        return type;
    }
}
// Registry for type-safe access
PortalType.registry = (() => {
    const map = {};
    for (const type of PORTAL_TYPE_ENUM) {
        map[type] = type;
    }
    return map;
})();
//# sourceMappingURL=portal-type.vo.js.map