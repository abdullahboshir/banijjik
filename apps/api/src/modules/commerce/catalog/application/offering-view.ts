import type { EffectiveCustomField } from "@banijjik/contracts";
import { publicFilePath } from "@banijjik/contracts/file";
import type {
  NamedReference,
  OfferingResponse,
  VariantResponse,
} from "@banijjik/contracts/catalog";
import type { Offering } from "../domain/offering.entity.js";
import type { Variant } from "../domain/variant.js";
import type { CatalogDependencies } from "./catalog-dependencies.js";
import { readableCustomFields } from "./custom-field-values.js";

const IMAGE_VARIANT = "medium";

export function toVariantResponse(variant: Variant): VariantResponse {
  return {
    variantId: variant.variantId,
    name: variant.name,
    optionValues: variant.optionValues,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    sku: variant.sku ?? null,
    barcode: variant.barcode ?? null,
    unitKey: variant.unitKey,
    quantityRule: variant.quantityRule ?? null,
    stockComponents: variant.stockComponents,
    overrides: variant.overrides,
    status: variant.status,
  };
}

function namedReferences(
  ids: readonly string[],
  names: ReadonlyMap<string, string>,
): NamedReference[] {
  return ids.flatMap((id) => {
    const name = names.get(id);
    return name === undefined ? [] : [{ referenceId: id, name }];
  });
}

/**
 * The full offering as `GET /offerings/{offeringId}` returns it. Category and add-on group names
 * come from one batched read each (no N+1); an image is the public address of its medium size
 * (offering images are PUBLIC files, ADR-109). Sensitive custom field values only for a caller
 * who may see them (ADR-107).
 */
export async function viewOffering(
  dependencies: Pick<CatalogDependencies, "categories" | "modifierGroups" | "sensitiveAccess">,
  offering: Offering,
  fields: readonly EffectiveCustomField[],
): Promise<OfferingResponse> {
  const [categoryNames, groupNames, canReadSensitive] = await Promise.all([
    dependencies.categories.findNames(offering.categoryIds),
    dependencies.modifierGroups.findNames(offering.modifierGroupIds),
    dependencies.sensitiveAccess.maySeeSensitive(),
  ]);
  return {
    offeringId: offering.offeringId,
    kind: offering.kind,
    name: offering.name,
    slug: offering.slug,
    status: offering.status,
    description: offering.description ?? null,
    categories: namedReferences(offering.categoryIds, categoryNames),
    modifierGroups: namedReferences(offering.modifierGroupIds, groupNames),
    images: offering.imageFileIds.map((fileId) => ({
      fileId,
      url: publicFilePath(fileId, IMAGE_VARIANT),
    })),
    variants: offering.variants.map(toVariantResponse),
    kindDetails: offering.kindDetails,
    taxClassKey: offering.taxClassKey ?? null,
    synonyms: offering.synonyms,
    customFields: readableCustomFields({
      stored: offering.customFields.values,
      fields,
      canReadSensitive,
    }),
    version: offering.version,
    createdAt: offering.createdAt.toISOString(),
    updatedAt: offering.updatedAt.toISOString(),
  };
}
