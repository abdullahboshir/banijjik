import type { StockComponent, VariantStatus } from "@banijjik/contracts/catalog";
import type { InventoryItemId, OfferingId, OrganizationId } from "@banijjik/ids";

export interface CatalogVariantStockView {
  readonly variantId: string;
  readonly stockComponents: readonly StockComponent[];
}

export interface CatalogOfferingAvailabilityView {
  readonly variants: readonly {
    readonly variantId: string;
    readonly status: VariantStatus;
    readonly stockComponents: readonly StockComponent[];
  }[];
}

export interface CatalogOfferingReader {
  findActiveVariant(
    organizationId: OrganizationId,
    offeringId: OfferingId,
    variantId: string,
  ): Promise<CatalogVariantStockView | undefined>;
  findOfferingForAvailability(
    organizationId: OrganizationId,
    offeringId: OfferingId,
  ): Promise<CatalogOfferingAvailabilityView | undefined>;
  isInventoryItemUsedInActiveVariant(inventoryItemId: InventoryItemId): Promise<boolean>;
}
