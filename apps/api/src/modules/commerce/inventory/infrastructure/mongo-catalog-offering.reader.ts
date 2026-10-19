import { OFFERING_STATUS, VARIANT_STATUS } from "@banijjik/contracts/catalog";
import { MongoOfferingRepository } from "../../catalog/index.js";
import type { InventoryItemId, OfferingId, OrganizationId } from "@banijjik/ids";
import type {
  CatalogOfferingAvailabilityView,
  CatalogOfferingReader,
  CatalogVariantStockView,
} from "../application/ports/catalog-offering-reader.js";

export class MongoCatalogOfferingReader implements CatalogOfferingReader {
  private readonly offerings = new MongoOfferingRepository();

  async findActiveVariant(
    _organizationId: OrganizationId,
    offeringId: OfferingId,
    variantId: string,
  ): Promise<CatalogVariantStockView | undefined> {
    const offering = await this.offerings.findById(offeringId);
    if (offering === undefined || offering.status !== OFFERING_STATUS.ACTIVE) return undefined;
    const variant = offering.variants.find(
      (row) => row.variantId === variantId && row.status === VARIANT_STATUS.ACTIVE,
    );
    if (variant === undefined) return undefined;
    return { variantId: variant.variantId, stockComponents: variant.stockComponents };
  }

  async findOfferingForAvailability(
    organizationId: OrganizationId,
    offeringId: OfferingId,
  ): Promise<CatalogOfferingAvailabilityView | undefined> {
    const offering = await this.offerings.findById(offeringId);
    if (offering === undefined || offering.organizationId !== organizationId) return undefined;
    return {
      variants: offering.variants.map((variant) => ({
        variantId: variant.variantId,
        status: variant.status,
        stockComponents: variant.stockComponents,
      })),
    };
  }

  isInventoryItemUsedInActiveVariant(inventoryItemId: InventoryItemId): Promise<boolean> {
    return this.offerings.isInventoryItemUsedInActiveVariant(inventoryItemId);
  }
}
