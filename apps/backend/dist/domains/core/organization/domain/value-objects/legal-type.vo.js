export class OrganizationLegal {
    constructor(value) {
        this.value = value;
    }
    static create(value) {
        return new OrganizationLegal(value);
    }
    getValue() {
        return this.value;
    }
}
//# sourceMappingURL=legal-type.vo.js.map