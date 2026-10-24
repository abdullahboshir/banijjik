import type { EventPayloadMap } from "@banijjik/contracts";
import type { InventoryEventType } from "@banijjik/contracts/inventory";
import type { OrganizationId } from "@banijjik/ids";

export interface InventoryEventPublisher {
  publish<Type extends InventoryEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
    options?: { readonly orderingKey?: string },
  ): Promise<void>;
}

export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface InventoryLocationLookup {
  isActiveLocation(locationId: string): Promise<boolean>;
}

export interface InventoryTimeZoneReader {
  /** A stock movement's business date follows the organization time zone. */
  read(organizationId: OrganizationId): Promise<string>;
}

export interface InventoryCurrencyReader {
  read(organizationId: OrganizationId): Promise<string>;
}

export interface InventorySettingsReader {
  allowNegativeStock(organizationId: OrganizationId): Promise<boolean>;
  lowStockDefault(organizationId: OrganizationId): Promise<number>;
  adjustmentApprovalAbove(organizationId: OrganizationId): Promise<number>;
  lowStockThresholdForItem(
    organizationId: OrganizationId,
    itemThreshold: number | undefined,
  ): Promise<number>;
}

export interface TransferNumberSequence {
  nextTransferNumber(organizationId: OrganizationId): Promise<string>;
}
