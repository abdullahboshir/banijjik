import { INVENTORY_ITEM_STATUS, type InventoryItemStatus } from "@banijjik/contracts/inventory";
import type { UnitKey } from "@banijjik/contracts/catalog";
import { newId, type InventoryItemId, type OrganizationId, type UserId } from "@banijjik/ids";

export interface InventoryItemProps {
  readonly inventoryItemId: InventoryItemId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly sku?: string;
  readonly baseUnitKey: UnitKey;
  readonly lowStockThreshold?: number;
  readonly status: InventoryItemStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class InventoryItem {
  private constructor(private readonly props: InventoryItemProps) {}

  static newId(): InventoryItemId {
    return newId<InventoryItemId>();
  }

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly name: string;
    readonly sku?: string;
    readonly baseUnitKey: UnitKey;
    readonly lowStockThreshold?: number;
    readonly now: Date;
  }): InventoryItem {
    return new InventoryItem({
      inventoryItemId: InventoryItem.newId(),
      organizationId: input.organizationId,
      name: input.name,
      ...(input.sku === undefined ? {} : { sku: input.sku }),
      baseUnitKey: input.baseUnitKey,
      ...(input.lowStockThreshold === undefined
        ? {}
        : { lowStockThreshold: input.lowStockThreshold }),
      status: INVENTORY_ITEM_STATUS.ACTIVE,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static restore(props: InventoryItemProps): InventoryItem {
    return new InventoryItem(props);
  }

  get inventoryItemId(): InventoryItemId {
    return this.props.inventoryItemId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get name(): string {
    return this.props.name;
  }

  get sku(): string | undefined {
    return this.props.sku;
  }

  get baseUnitKey(): UnitKey {
    return this.props.baseUnitKey;
  }

  get lowStockThreshold(): number | undefined {
    return this.props.lowStockThreshold;
  }

  get status(): InventoryItemStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  isActive(): boolean {
    return this.status === INVENTORY_ITEM_STATUS.ACTIVE;
  }

  withUpdate(input: {
    readonly actorUserId: UserId;
    readonly now: Date;
    readonly name?: string;
    readonly sku?: string | null;
    readonly lowStockThreshold?: number | null;
  }): InventoryItem {
    const sku = resolveClearable(input.sku, this.sku);
    const lowStockThreshold = resolveClearable(input.lowStockThreshold, this.lowStockThreshold);
    return new InventoryItem({
      ...this.props,
      name: input.name ?? this.name,
      ...(sku === undefined ? {} : { sku }),
      ...(lowStockThreshold === undefined ? {} : { lowStockThreshold }),
      version: this.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  archived(actorUserId: UserId, now: Date): InventoryItem {
    return new InventoryItem({
      ...this.props,
      status: INVENTORY_ITEM_STATUS.ARCHIVED,
      version: this.version + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
}

/** `null` clears, `undefined` keeps the current value, anything else replaces it. */
function resolveClearable<Value>(
  change: Value | null | undefined,
  current: Value | undefined,
): Value | undefined {
  if (change === null) return undefined;
  if (change === undefined) return current;
  return change;
}
