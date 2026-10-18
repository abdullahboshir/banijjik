import type { CurrencyCode } from "@banijjik/contracts";
import { asId, type OfferingId, type OrganizationId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Offering, nameSearchOf, synonymSearchOf } from "../domain/offering.entity.js";
import type { Variant } from "../domain/variant.js";
import type { OfferingDocument, VariantDocument } from "./offering.schema.js";

function toVariantDocument(variant: Variant): VariantDocument {
  return {
    variantId: variant.variantId,
    name: variant.name,
    optionValues: { ...variant.optionValues },
    price: { ...variant.price },
    unitKey: variant.unitKey,
    stockComponents: variant.stockComponents.map((component) => ({ ...component })),
    overrides: { ...variant.overrides },
    status: variant.status,
    ...(variant.compareAtPrice === undefined
      ? {}
      : { compareAtPrice: { ...variant.compareAtPrice } }),
    ...(variant.sku === undefined ? {} : { sku: variant.sku }),
    ...(variant.barcode === undefined ? {} : { barcode: variant.barcode }),
    ...(variant.quantityRule === undefined ? {} : { quantityRule: { ...variant.quantityRule } }),
  };
}

function toVariant(document: VariantDocument): Variant {
  return {
    variantId: document.variantId,
    name: document.name,
    optionValues: document.optionValues ?? {},
    price: { amount: document.price.amount, currency: document.price.currency as CurrencyCode },
    compareAtPrice:
      document.compareAtPrice === undefined
        ? undefined
        : {
            amount: document.compareAtPrice.amount,
            currency: document.compareAtPrice.currency as CurrencyCode,
          },
    sku: document.sku,
    barcode: document.barcode,
    unitKey: document.unitKey,
    quantityRule:
      document.quantityRule === undefined
        ? undefined
        : {
            min: document.quantityRule.min,
            step: document.quantityRule.step,
            ...(document.quantityRule.max === undefined ? {} : { max: document.quantityRule.max }),
          },
    stockComponents: document.stockComponents ?? [],
    overrides: document.overrides ?? {},
    status: document.status,
  };
}

export type EditableOfferingFields = Pick<
  OfferingDocument,
  | "name"
  | "nameSearch"
  | "slug"
  | "status"
  | "categoryIds"
  | "modifierGroupIds"
  | "imageFileIds"
  | "variants"
  | "kindDetails"
  | "synonyms"
  | "searchTerms"
  | "customFields"
  | "customFieldSearch"
>;

/** The fields an edit sets. `description` and `taxClassKey` are set or unset by the repository. */
export function offeringEditableFields(offering: Offering): EditableOfferingFields {
  return {
    name: offering.name,
    nameSearch: nameSearchOf(offering.name),
    slug: offering.slug,
    status: offering.status,
    categoryIds: [...offering.categoryIds],
    modifierGroupIds: [...offering.modifierGroupIds],
    imageFileIds: [...offering.imageFileIds],
    variants: offering.variants.map(toVariantDocument),
    kindDetails: offering.kindDetails,
    synonyms: [...offering.synonyms],
    searchTerms: synonymSearchOf(offering.synonyms),
    customFields: { ...offering.customFields.values },
    customFieldSearch: offering.customFields.search.map((entry) => ({ ...entry })),
  };
}

export function toOfferingDocument(offering: Offering): OfferingDocument {
  return {
    offeringId: offering.offeringId,
    organizationId: offering.organizationId,
    kind: offering.kind,
    ...offeringEditableFields(offering),
    version: offering.version,
    createdAt: offering.createdAt,
    updatedAt: offering.updatedAt,
    createdByUserId: offering.createdByUserId,
    updatedByUserId: null,
    ...(offering.description === undefined ? {} : { description: offering.description }),
    ...(offering.taxClassKey === undefined ? {} : { taxClassKey: offering.taxClassKey }),
  };
}

export function toOffering(document: OfferingDocument): Offering {
  const stored = stripMongoInternals(document);
  return Offering.restore({
    offeringId: asId<OfferingId>(stored.offeringId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    kind: stored.kind,
    name: stored.name,
    slug: stored.slug,
    status: stored.status,
    description: stored.description,
    categoryIds: stored.categoryIds,
    modifierGroupIds: stored.modifierGroupIds,
    imageFileIds: stored.imageFileIds,
    variants: stored.variants.map(toVariant),
    kindDetails: stored.kindDetails,
    taxClassKey: stored.taxClassKey,
    synonyms: stored.synonyms,
    customFields: {
      values: stored.customFields ?? {},
      search: stored.customFieldSearch ?? [],
    },
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: stored.createdByUserId === null ? null : asId<UserId>(stored.createdByUserId),
  });
}
