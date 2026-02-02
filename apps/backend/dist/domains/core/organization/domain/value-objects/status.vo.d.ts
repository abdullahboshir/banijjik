import { OrganizationStatusType } from "@banijjik/contracts";
export declare class OrganizationStatus {
    private readonly value;
    private constructor();
    static create(value: OrganizationStatusType): OrganizationStatus;
    static get ACTIVE(): OrganizationStatus;
    static get PENDING(): OrganizationStatus;
    getValue(): OrganizationStatusType;
}
//# sourceMappingURL=status.vo.d.ts.map