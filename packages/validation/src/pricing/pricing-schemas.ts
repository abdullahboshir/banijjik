import { OFFERING_KIND } from "@banijjik/contracts";
import {
  MANUAL_DISCOUNT_TYPE,
  MAX_MODIFIER_OPTIONS_PER_LINE,
  MAX_PROMOTION_NAME_LENGTH,
  MAX_QUOTE_LINES,
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  PROMOTION_TARGET_SCOPE,
  TAX_CLASS_KEY_MAX_LENGTH,
  TAX_CLASS_KEY_PATTERN,
  TAX_CLASS_STATUS,
} from "@banijjik/contracts/pricing";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const MAX_BASIS_POINTS = 100_000;
const MAX_PRIORITY = 1_000_000;
const MAX_LOCATION_IDS = 100;
const MAX_TARGET_IDS = 100;

export const taxClassKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(TAX_CLASS_KEY_MAX_LENGTH)
  .regex(TAX_CLASS_KEY_PATTERN);

const optionalTaxClassKeySchema = z
  .string()
  .trim()
  .max(TAX_CLASS_KEY_MAX_LENGTH)
  .regex(TAX_CLASS_KEY_PATTERN)
  .or(z.literal(""));

const basisPointsSchema = z.number().int().min(0).max(MAX_BASIS_POINTS);

const manualDiscountSchema = z.strictObject({
  type: z.enum(MANUAL_DISCOUNT_TYPE),
  value: z.number().int().min(0).max(MAX_SAFE),
});

export const taxClassCreateRequestSchema = z.strictObject({
  taxClassKey: taxClassKeySchema,
  name: z.string().trim().min(1).max(MAX_PROMOTION_NAME_LENGTH),
  rateBasisPoints: basisPointsSchema,
});

export const taxClassUpdateRequestSchema = z
  .strictObject({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(MAX_PROMOTION_NAME_LENGTH).optional(),
    rateBasisPoints: basisPointsSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.rateBasisPoints !== undefined);

/** Not strict: the tenant mount also puts `organizationId` on `req.params`. */
export const taxClassIdParamsSchema = z.object({
  taxClassId: uuidV7Schema,
});

export const taxClassListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(TAX_CLASS_STATUS).optional(),
});

export const taxClassArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

const promotionTargetSchema = z
  .strictObject({
    scope: z.enum(PROMOTION_TARGET_SCOPE),
    ids: z.array(z.string().trim().min(1).max(64)).max(MAX_TARGET_IDS),
  })
  .superRefine((target, context) => {
    if (target.scope === PROMOTION_TARGET_SCOPE.ALL) {
      if (target.ids.length > 0) context.addIssue({ code: "custom", path: ["ids"] });
      return;
    }
    if (target.ids.length === 0) {
      context.addIssue({ code: "custom", path: ["ids"] });
      return;
    }
    if (new Set(target.ids).size !== target.ids.length) {
      context.addIssue({ code: "custom", path: ["ids"] });
    }
    if (target.scope === PROMOTION_TARGET_SCOPE.KIND) {
      for (const [index, id] of target.ids.entries()) {
        if (!(Object.values(OFFERING_KIND) as string[]).includes(id)) {
          context.addIssue({ code: "custom", path: ["ids", index] });
        }
      }
      return;
    }
    for (const [index, id] of target.ids.entries()) {
      if (!uuidV7Schema.safeParse(id).success) {
        context.addIssue({ code: "custom", path: ["ids", index] });
      }
    }
  });

const promotionBenefitSchema = z
  .strictObject({
    type: z.enum(PROMOTION_BENEFIT_TYPE),
    value: z.union([z.number().int().min(0).max(MAX_SAFE), moneySchema]),
  })
  .superRefine((benefit, context) => {
    if (benefit.type === PROMOTION_BENEFIT_TYPE.PERCENT) {
      if (typeof benefit.value !== "number" || benefit.value > MAX_BASIS_POINTS) {
        context.addIssue({ code: "custom", path: ["value"] });
      }
      return;
    }
    if (typeof benefit.value !== "object") {
      context.addIssue({ code: "custom", path: ["value"] });
    }
  });

export const promotionCreateRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(MAX_PROMOTION_NAME_LENGTH),
  priority: z.number().int().min(0).max(MAX_PRIORITY).default(0),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  locationIds: z.array(uuidV7Schema).max(MAX_LOCATION_IDS).default([]),
  target: promotionTargetSchema,
  benefit: promotionBenefitSchema,
  minQuantity: z.number().int().positive().max(MAX_SAFE).optional(),
  isStackable: z.boolean().default(false),
  maxDiscountPerLine: moneySchema.optional(),
});

const promotionUpdateFieldsSchema = z.strictObject({
  version: z.number().int().positive(),
  name: z.string().trim().min(1).max(MAX_PROMOTION_NAME_LENGTH).optional(),
  priority: z.number().int().min(0).max(MAX_PRIORITY).optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  locationIds: z.array(uuidV7Schema).max(MAX_LOCATION_IDS).optional(),
  target: promotionTargetSchema.optional(),
  benefit: promotionBenefitSchema.optional(),
  minQuantity: z.number().int().positive().max(MAX_SAFE).nullable().optional(),
  isStackable: z.boolean().optional(),
  maxDiscountPerLine: moneySchema.nullable().optional(),
  status: z.enum([PROMOTION_STATUS.DRAFT, PROMOTION_STATUS.ACTIVE]).optional(),
});

function hasPromotionUpdateField(body: z.infer<typeof promotionUpdateFieldsSchema>): boolean {
  const keys = [
    "name",
    "priority",
    "startsAt",
    "endsAt",
    "locationIds",
    "target",
    "benefit",
    "minQuantity",
    "isStackable",
    "maxDiscountPerLine",
    "status",
  ] as const;
  return keys.some((key) => body[key] !== undefined);
}

export const promotionUpdateRequestSchema =
  promotionUpdateFieldsSchema.refine(hasPromotionUpdateField);

/** Not strict: the tenant mount also puts `organizationId` on `req.params`. */
export const promotionIdParamsSchema = z.object({
  promotionId: uuidV7Schema,
});

export const promotionListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PROMOTION_STATUS).optional(),
});

export const promotionArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

export const quoteRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  at: z.string().datetime({ offset: true }).optional(),
  lines: z
    .array(
      z.strictObject({
        offeringId: uuidV7Schema,
        variantId: uuidV7Schema,
        quantity: z.number().int().positive().max(MAX_SAFE),
        modifierOptionIds: z.array(uuidV7Schema).max(MAX_MODIFIER_OPTIONS_PER_LINE).default([]),
        manualDiscount: manualDiscountSchema.optional(),
        unitPriceOverride: moneySchema.optional(),
      }),
    )
    .min(1)
    .max(MAX_QUOTE_LINES),
  orderDiscount: manualDiscountSchema.optional(),
  paymentIsCash: z.boolean().optional(),
  deliveryCharge: moneySchema.optional(),
});

/** Exported for settings tests that assert the default-class key shape. */
export { optionalTaxClassKeySchema };

export type TaxClassCreateBody = z.infer<typeof taxClassCreateRequestSchema>;
export type TaxClassUpdateBody = z.infer<typeof taxClassUpdateRequestSchema>;
export type TaxClassListQuery = z.infer<typeof taxClassListQuerySchema>;
export type PromotionCreateBody = z.infer<typeof promotionCreateRequestSchema>;
export type PromotionUpdateBody = z.infer<typeof promotionUpdateRequestSchema>;
export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;
export type QuoteBody = z.infer<typeof quoteRequestSchema>;
