import { ORGANIZATION_INDUSTRY, } from "@banijjik/contracts";
export class OrganizationIndustry {
    constructor(value) {
        this.value = value;
    }
    static create(value) {
        // Validation logic if needed
        if (!Object.values(ORGANIZATION_INDUSTRY).includes(value)) {
            throw new Error("Invalid Industry Type");
        }
        return new OrganizationIndustry(value);
    }
    getValue() {
        return this.value;
    }
}
//# sourceMappingURL=industry.vo.js.map