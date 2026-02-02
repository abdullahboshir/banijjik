import {
  PORTAL_TYPE_ENUM,
  PortalType as PortalTypeContract,
} from "@banijjik/contracts";

export class PortalType {
  private constructor(private readonly value: PortalTypeContract) {}

  // Registry for type-safe access
  private static readonly registry: Record<
    PortalTypeContract,
    PortalTypeContract
  > = (() => {
    const map = {} as Record<PortalTypeContract, PortalTypeContract>;
    for (const type of PORTAL_TYPE_ENUM) {
      map[type] = type;
    }
    return map;
  })();

  static get VALUE(): Readonly<typeof PortalType.registry> {
    return this.registry;
  }

  static from(value: string): PortalTypeContract {
    const type = value.toUpperCase() as PortalTypeContract;
    if (!PORTAL_TYPE_ENUM.includes(type)) {
      throw new Error(`Invalid PortalType: ${value}`);
    }
    return type;
  }
}
