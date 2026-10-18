import { OFFERING_KIND } from "@banijjik/contracts";
import {
  MAX_OFFERING_CATEGORIES,
  MAX_OFFERING_DESCRIPTION_LENGTH,
  MAX_OFFERING_IMAGES,
  MAX_OFFERING_MODIFIER_GROUPS,
  MAX_OFFERING_SYNONYMS,
  MAX_OPTION_NAMES_PER_VARIANT,
  MAX_SYNONYM_LENGTH,
  MAX_VARIANTS_PER_OFFERING,
  OFFERING_NAME_MAX_LENGTH,
  OFFERING_STATUS,
} from "@banijjik/contracts/catalog";
import { z } from "zod";
import {
  customFieldValuesRequestSchema,
  versionSchema,
} from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import {
  barcodeSchema,
  idListSchema,
  moneySchema,
  quantityRuleSchema,
  skuSchema,
  slugSchema,
  stockComponentsSchema,
  unitKeySchema,
} from "./catalog-parts.js";
import { parseKindDetails, parseVariantOverrides, type ParseIssue } from "./kind-details.js";

const VARIANT_NAME_MAX_LENGTH = 120;
const OPTION_NAME_MAX_LENGTH = 40;
const OPTION_VALUE_MAX_LENGTH = 60;
const TAX_CLASS_KEY_MAX_LENGTH = 40;
const SEARCH_MAX_LENGTH = 80;

const optionValuesSchema = z
  .record(
    z.string().trim().min(1).max(OPTION_NAME_MAX_LENGTH),
    z.string().trim().min(1).max(OPTION_VALUE_MAX_LENGTH),
  )
  .refine((options) => Object.keys(options).length <= MAX_OPTION_NAMES_PER_VARIANT);

/** One variant as sent: a known `variantId` keeps its id, a missing one is issued by the server. */
export const variantInputSchema = z
  .strictObject({
    variantId: uuidV7Schema.optional(),
    name: z.string().trim().min(1).max(VARIANT_NAME_MAX_LENGTH).optional(),
    optionValues: optionValuesSchema.optional(),
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    sku: skuSchema.optional(),
    barcode: barcodeSchema.optional(),
    unitKey: unitKeySchema,
    quantityRule: quantityRuleSchema.optional(),
    stockComponents: stockComponentsSchema.optional(),
    /** Checked against the offering's kind by `checkKindParts`. */
    overrides: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (variant) =>
      variant.compareAtPrice === undefined || variant.compareAtPrice.amount >= variant.price.amount,
    { path: ["compareAtPrice"] },
  )
  .refine(
    (variant) =>
      variant.compareAtPrice === undefined ||
      variant.compareAtPrice.currency === variant.price.currency,
    { path: ["compareAtPrice", "currency"] },
  );
export type VariantInput = z.output<typeof variantInputSchema>;

const variantsSchema = z.array(variantInputSchema).min(1).max(MAX_VARIANTS_PER_OFFERING);

const nameSchema = z.string().trim().min(1).max(OFFERING_NAME_MAX_LENGTH);
const descriptionSchema = z.string().trim().min(1).max(MAX_OFFERING_DESCRIPTION_LENGTH);
const synonymsSchema = z
  .array(z.string().trim().min(1).max(MAX_SYNONYM_LENGTH))
  .max(MAX_OFFERING_SYNONYMS);
const taxClassKeySchema = z.string().trim().min(1).max(TAX_CLASS_KEY_MAX_LENGTH);

type AddIssue = (issue: { code: "custom"; path: PropertyKey[] }) => void;

function reportIssues(
  addIssue: AddIssue,
  prefix: readonly PropertyKey[],
  issues: readonly ParseIssue[],
) {
  for (const issue of issues) addIssue({ code: "custom", path: [...prefix, ...issue.path] });
}

/**
 * A field of another kind in `kindDetails`, or in a variant's `overrides`, is a 400 at its own path.
 * Returns the parsed details with the kind's defaults applied.
 */
function checkKindParts(
  body: {
    kind: (typeof OFFERING_KIND)[keyof typeof OFFERING_KIND];
    kindDetails?: unknown;
    variants?: readonly VariantInput[] | undefined;
  },
  addIssue: AddIssue,
) {
  const details = parseKindDetails(body.kind, body.kindDetails);
  if (!details.success) reportIssues(addIssue, ["kindDetails"], details.issues);
  (body.variants ?? []).forEach((variant, index) => {
    const overrides = parseVariantOverrides(body.kind, variant.overrides);
    if (!overrides.success) {
      reportIssues(addIssue, ["variants", index, "overrides"], overrides.issues);
    }
  });
  return details;
}

/** Body of `POST /orgs/{organizationId}/offerings`. */
export const offeringCreateRequestSchema = z
  .strictObject({
    kind: z.enum(OFFERING_KIND),
    name: nameSchema,
    slug: slugSchema.optional(),
    description: descriptionSchema.optional(),
    categoryIds: idListSchema(MAX_OFFERING_CATEGORIES).optional(),
    modifierGroupIds: idListSchema(MAX_OFFERING_MODIFIER_GROUPS).optional(),
    imageFileIds: idListSchema(MAX_OFFERING_IMAGES).optional(),
    kindDetails: z.record(z.string(), z.unknown()).optional(),
    taxClassKey: taxClassKeySchema.optional(),
    synonyms: synonymsSchema.optional(),
    /** Either the full variant list, or `price` (and `unitKey`) for the one "Default" variant. */
    variants: variantsSchema.optional(),
    price: moneySchema.optional(),
    unitKey: unitKeySchema.optional(),
    customFields: customFieldValuesRequestSchema.optional(),
  })
  .superRefine((body, context) => {
    if ((body.variants === undefined) === (body.price === undefined)) {
      context.addIssue({ code: "custom", path: ["variants"] });
    }
    if (body.variants !== undefined && body.unitKey !== undefined) {
      context.addIssue({ code: "custom", path: ["unitKey"] });
    }
  })
  .transform((body, context) => {
    const details = checkKindParts(body, (issue) => context.addIssue(issue));
    if (!details.success) return z.NEVER;
    return { ...body, kindDetails: details.data };
  });
export type OfferingCreateBody = z.output<typeof offeringCreateRequestSchema>;

/**
 * Body of `PATCH /offerings/{offeringId}`; at least one field besides `version`. `kindDetails` and
 * `variants` replace what is stored (the use case checks them against the offering's kind, which is
 * immutable); an absent key leaves the field alone and `null` clears an optional one.
 */
export const offeringUpdateRequestSchema = z
  .strictObject({
    name: nameSchema.optional(),
    slug: slugSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    categoryIds: idListSchema(MAX_OFFERING_CATEGORIES).optional(),
    modifierGroupIds: idListSchema(MAX_OFFERING_MODIFIER_GROUPS).optional(),
    imageFileIds: idListSchema(MAX_OFFERING_IMAGES).optional(),
    kindDetails: z.record(z.string(), z.unknown()).optional(),
    taxClassKey: taxClassKeySchema.nullable().optional(),
    synonyms: synonymsSchema.optional(),
    variants: variantsSchema.optional(),
    customFields: customFieldValuesRequestSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type OfferingUpdateBody = z.output<typeof offeringUpdateRequestSchema>;

export const offeringIdParamsSchema = z.object({ offeringId: uuidV7Schema });

export const offeringLocationParamsSchema = z.object({
  offeringId: uuidV7Schema,
  locationId: uuidV7Schema,
});

/** Body of `PUT /offerings/{offeringId}/locations/{locationId}`. */
export const offeringLocationRequestSchema = z.strictObject({
  variantId: uuidV7Schema.optional(),
  isAvailable: z.boolean(),
  priceOverride: moneySchema.optional(),
});
export type OfferingLocationBody = z.output<typeof offeringLocationRequestSchema>;

/** `?variantId=` of `DELETE /offerings/{offeringId}/locations/{locationId}`. */
export const offeringLocationClearQuerySchema = z.strictObject({
  variantId: uuidV7Schema.optional(),
});

/** `?locationId=&page=&limit=` of `GET /offerings/{offeringId}/locations`. */
export const offeringLocationListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
});
export type OfferingLocationListQuery = z.output<typeof offeringLocationListQuerySchema>;

/**
 * `?q=&kind=&status=&categoryId=&location=&page=&limit=` of `GET /offerings`. Without `status` the
 * list shows DRAFT and ACTIVE offerings; ARCHIVED ones are asked for by name.
 */
export const offeringListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
  kind: z.enum(OFFERING_KIND).optional(),
  status: z.enum(OFFERING_STATUS).optional(),
  categoryId: uuidV7Schema.optional(),
  location: uuidV7Schema.optional(),
});
export type OfferingListQuery = z.output<typeof offeringListQuerySchema>;
