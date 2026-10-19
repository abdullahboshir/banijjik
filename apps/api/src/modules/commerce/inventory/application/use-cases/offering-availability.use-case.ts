import { VARIANT_STATUS } from "@banijjik/contracts/catalog";
import type { OfferingAvailabilityResponse } from "@banijjik/contracts/inventory";
import type { InventoryItemId, OfferingId, OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import { assertLocationReach } from "./stock-use-case-shared.js";

async function variantAvailableQuantity(input: {
  readonly levels: InventoryDependencies["levels"];
  readonly organizationId: OrganizationId;
  readonly locationId: string;
  readonly stockComponents: readonly {
    readonly inventoryItemId: string;
    readonly quantity: number;
  }[];
}): Promise<number> {
  if (input.stockComponents.length === 0) return 0;
  let availableQuantity = Number.POSITIVE_INFINITY;
  for (const component of input.stockComponents) {
    const level = await input.levels.findOne({
      organizationId: input.organizationId,
      locationId: input.locationId,
      inventoryItemId: component.inventoryItemId as InventoryItemId,
    });
    const available = (level?.onHand ?? 0) - (level?.reserved ?? 0);
    availableQuantity = Math.min(availableQuantity, Math.floor(available / component.quantity));
  }
  return Number.isFinite(availableQuantity) ? availableQuantity : 0;
}

export class GetOfferingAvailabilityUseCase {
  constructor(private readonly dependencies: Pick<InventoryDependencies, "levels" | "offerings">) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly offeringId: OfferingId;
    readonly locationId: string;
  }): Promise<OfferingAvailabilityResponse> {
    assertLocationReach(input.allowedLocationIds, input.locationId);
    const offering = await this.dependencies.offerings.findOfferingForAvailability(
      input.organizationId,
      input.offeringId,
    );
    if (offering === undefined) throw recordNotFound();
    const variants = [];
    for (const variant of offering.variants) {
      if (variant.status !== VARIANT_STATUS.ACTIVE) continue;
      const availableQuantity = await variantAvailableQuantity({
        levels: this.dependencies.levels,
        organizationId: input.organizationId,
        locationId: input.locationId,
        stockComponents: variant.stockComponents,
      });
      variants.push({ variantId: variant.variantId, availableQuantity });
    }
    return { offeringId: input.offeringId, locationId: input.locationId, variants };
  }
}
