export class OrganizationLocalization {
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        // Validation
        return new OrganizationLocalization(props);
    }
    toValue() {
        return { ...this.props };
    }
}
//# sourceMappingURL=localization.vo.js.map