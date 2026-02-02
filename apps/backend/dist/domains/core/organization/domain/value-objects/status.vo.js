import { ORGANIZATION_STATUS, } from "@banijjik/contracts";
export class OrganizationStatus {
    constructor(value) {
        this.value = value;
    }
    static create(value) {
        return new OrganizationStatus(value);
    }
    static get ACTIVE() {
        return new OrganizationStatus(ORGANIZATION_STATUS.ACTIVE);
    }
    static get PENDING() {
        return new OrganizationStatus(ORGANIZATION_STATUS.PENDING);
    }
    getValue() {
        return this.value;
    }
}
//# sourceMappingURL=status.vo.js.map