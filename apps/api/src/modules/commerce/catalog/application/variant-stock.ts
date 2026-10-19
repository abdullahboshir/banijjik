import { OFFERING_KIND } from "@banijjik/contracts";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { isActiveVariant, type Variant } from "../domain/variant.js";
import type { VariantDraft } from "../domain/variant-merge.js";
import type { CatalogDependencies } from "./catalog-dependencies.js";

export async function applyVariantStockRules(input: {
  readonly dependencies: Pick<
    CatalogDependencies,
    "inventoryComponents" | "defaultStockItems" | "defaultStockTracked"
  >;
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly kind: (typeof OFFERING_KIND)[keyof typeof OFFERING_KIND];
  readonly offeringName: string;
  readonly variants: readonly Variant[];
  readonly drafts: readonly VariantDraft[];
}): Promise<Variant[]> {
  const { dependencies, organizationId, actorUserId, kind, offeringName, drafts } = input;
  const trackByDefault =
    kind === OFFERING_KIND.PRODUCT && (await dependencies.defaultStockTracked.read(organizationId));
  const active = input.variants.filter(isActiveVariant);
  const archived = input.variants.filter((variant) => !isActiveVariant(variant));
  const nextActive: Variant[] = [];
  for (let index = 0; index < active.length; index += 1) {
    let variant = active[index];
    if (variant === undefined) continue;
    const draft = drafts[index];
    const isNew = draft?.variantId === undefined;
    if (trackByDefault && isNew && variant.stockComponents.length === 0) {
      const created = await dependencies.defaultStockItems.createDefaultLinkedItem({
        organizationId,
        actorUserId,
        offeringName,
        variantName: variant.name,
        baseUnitKey: variant.unitKey,
      });
      variant = {
        ...variant,
        stockComponents: [{ inventoryItemId: created.inventoryItemId, quantity: 1 }],
      };
    }
    await dependencies.inventoryComponents.assertComponentsValid(
      organizationId,
      variant.stockComponents,
      `variants.${index}.stockComponents`,
    );
    nextActive.push(variant);
  }
  return [...nextActive, ...archived];
}
