import { CATALOG_RECORD_STATUS, MODIFIER_SELECTION } from "@banijjik/contracts/catalog";
import { MAX_MODIFIER_OPTIONS } from "@banijjik/contracts/catalog";
import { z } from "zod";
import {
  customFieldValuesRequestSchema,
  versionSchema,
} from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { moneySchema, slugSchema } from "./catalog-parts.js";

const NAME_MAX_LENGTH = 120;
const SORT_ORDER_MAX = 100_000;

const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);
const sortOrderSchema = z.number().int().min(0).max(SORT_ORDER_MAX);

/** Body of `POST /orgs/{organizationId}/categories`. */
export const categoryCreateRequestSchema = z.strictObject({
  name: nameSchema,
  slug: slugSchema.optional(),
  parentCategoryId: uuidV7Schema.optional(),
  sortOrder: sortOrderSchema.default(0),
  imageFileId: uuidV7Schema.optional(),
  customFields: customFieldValuesRequestSchema.optional(),
});
export type CategoryCreateBody = z.output<typeof categoryCreateRequestSchema>;

/** Body of `PATCH /categories/{categoryId}`; `null` clears the parent or the image. */
export const categoryUpdateRequestSchema = z
  .strictObject({
    name: nameSchema.optional(),
    slug: slugSchema.optional(),
    parentCategoryId: uuidV7Schema.nullable().optional(),
    sortOrder: sortOrderSchema.optional(),
    imageFileId: uuidV7Schema.nullable().optional(),
    customFields: customFieldValuesRequestSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type CategoryUpdateBody = z.output<typeof categoryUpdateRequestSchema>;

export const categoryIdParamsSchema = z.object({ categoryId: uuidV7Schema });

/** `?status=&page=&limit=` of `GET /categories`. The status defaults to ACTIVE. */
export const categoryListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(CATALOG_RECORD_STATUS).default(CATALOG_RECORD_STATUS.ACTIVE),
});
export type CategoryListQuery = z.output<typeof categoryListQuerySchema>;

const modifierOptionSchema = z.strictObject({
  modifierOptionId: uuidV7Schema.optional(),
  name: nameSchema,
  priceDelta: moneySchema,
  status: z.enum(CATALOG_RECORD_STATUS).default(CATALOG_RECORD_STATUS.ACTIVE),
});
export type ModifierOptionInput = z.output<typeof modifierOptionSchema>;

const optionsSchema = z.array(modifierOptionSchema).min(1).max(MAX_MODIFIER_OPTIONS);

/** The rules that tie `selection`, `isRequired`, `minSelect` and `maxSelect` together, without the option count. */
function selectionIsConsistent(group: {
  selection: (typeof MODIFIER_SELECTION)[keyof typeof MODIFIER_SELECTION];
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
}): boolean {
  if (group.minSelect > group.maxSelect) return false;
  if (group.isRequired !== group.minSelect >= 1) return false;
  return group.selection === MODIFIER_SELECTION.SINGLE ? group.maxSelect === 1 : true;
}

const modifierGroupShape = {
  name: nameSchema,
  selection: z.enum(MODIFIER_SELECTION),
  isRequired: z.boolean(),
  minSelect: z.number().int().min(0).max(MAX_MODIFIER_OPTIONS),
  maxSelect: z.number().int().min(1).max(MAX_MODIFIER_OPTIONS),
  options: optionsSchema,
};

/** Body of `POST /orgs/{organizationId}/modifier-groups` (add-on groups, ADR-072). */
export const modifierGroupCreateRequestSchema = z
  .strictObject(modifierGroupShape)
  .refine(selectionIsConsistent, { path: ["selection"] });
export type ModifierGroupCreateBody = z.output<typeof modifierGroupCreateRequestSchema>;

/** Body of `PATCH /modifier-groups/{modifierGroupId}`. `options` is the full list: missing ones are archived. */
export const modifierGroupUpdateRequestSchema = z
  .strictObject({
    name: nameSchema.optional(),
    selection: z.enum(MODIFIER_SELECTION).optional(),
    isRequired: z.boolean().optional(),
    minSelect: modifierGroupShape.minSelect.optional(),
    maxSelect: modifierGroupShape.maxSelect.optional(),
    options: optionsSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type ModifierGroupUpdateBody = z.output<typeof modifierGroupUpdateRequestSchema>;

export const modifierGroupIdParamsSchema = z.object({ modifierGroupId: uuidV7Schema });

export const modifierGroupListQuerySchema = categoryListQuerySchema;
export type ModifierGroupListQuery = CategoryListQuery;
