import { DEPLOYMENT_TYPE_ENUM, } from "@banijjik/contracts";
export class OrganizationDeployment {
    constructor(props) {
        this.props = props;
    }
    static get VALUE() {
        return this.registry;
    }
    static create(props) {
        return new OrganizationDeployment(props);
    }
    toValue() {
        return { ...this.props };
    }
}
// Registry for type-safe access without hardcoded strings
OrganizationDeployment.registry = (() => {
    const map = {};
    for (const type of DEPLOYMENT_TYPE_ENUM) {
        map[type] = type;
    }
    return map;
})();
//# sourceMappingURL=deployment.vo.js.map