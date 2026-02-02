import { PortalType as PortalTypeContract } from "@banijjik/contracts";
export declare class PortalType {
    private readonly value;
    private constructor();
    private static readonly registry;
    static get VALUE(): Readonly<typeof PortalType.registry>;
    static from(value: string): PortalTypeContract;
}
//# sourceMappingURL=portal-type.vo.d.ts.map