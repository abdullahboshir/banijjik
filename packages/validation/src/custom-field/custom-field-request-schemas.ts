import {
  CUSTOM_FIELD_ENTITY_TYPE,
  CUSTOM_FIELD_TYPE,
  OFFERING_KIND,
  type CustomFieldArchiveRequest,
  type CustomFieldDefinitionCreateRequest,
  type CustomFieldDefinitionUpdateRequest,
  type CustomFieldListQuery,
  type CustomFieldPreferenceBatchRequest,
} from "@banijjik/contracts";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { CUSTOM_FIELD_LONG_TEXT_MAX_LENGTH } from "./custom-field-limits.js";

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const LABEL_MAX = 160;
const OPTION_MAX_LENGTH = 40;
const OPTION_LIST_MAX = 100;
const SORT_ORDER_MAX = 10_000;
const PREFERENCE_BATCH_MAX = 100;

const localizedTextSchema = z.strictObject({
  bn: z.string().trim().min(1).max(LABEL_MAX),
  en: z.string().trim().min(1).max(LABEL_MAX),
});

const visibilitySchema = z.strictObject({
  admin: z.boolean(),
  storefront: z.boolean(),
  bot: z.boolean(),
});

const boundsSchema = z
  .strictObject({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxLength: z.number().int().positive().max(CUSTOM_FIELD_LONG_TEXT_MAX_LENGTH).optional(),
  })
  .refine((value) => value.min === undefined || value.max === undefined || value.max >= value.min, {
    path: ["max"],
  });

const optionListSchema = z
  .array(z.string().trim().min(1).max(OPTION_MAX_LENGTH))
  .min(1)
  .max(OPTION_LIST_MAX);

const entityTypeSchema = z.enum(CUSTOM_FIELD_ENTITY_TYPE);
const offeringKindSchema = z.enum(OFFERING_KIND);

interface FieldShape {
  readonly entityType: string;
  readonly fieldType: string;
  readonly offeringKind?: string | undefined;
  readonly options?: readonly string[] | undefined;
  readonly optionLabels?: Readonly<Record<string, unknown>> | undefined;
  readonly referenceEntity?: string | undefined;
}

function optionsAreUnique(options: readonly string[] | undefined): boolean {
  if (options === undefined) return true;
  return new Set(options).size === options.length;
}

function optionLabelsMatch(field: FieldShape): boolean {
  if (field.optionLabels === undefined) return true;
  const options = field.options ?? [];
  const keys = Object.keys(field.optionLabels);
  if (keys.length !== options.length) return false;
  return options.every((option) => field.optionLabels?.[option] !== undefined);
}

/** SELECT needs options; REFERENCE needs a target; offeringKind belongs only on offering. */
function fieldIsConsistent(field: FieldShape): boolean {
  const needsOptions = field.fieldType === "SELECT" || field.fieldType === "MULTI_SELECT";
  const hasOptions = field.options !== undefined && field.options.length > 0;
  if (needsOptions !== hasOptions) return false;
  if (!needsOptions && field.optionLabels !== undefined) return false;
  if (!optionLabelsMatch(field)) return false;
  if (!optionsAreUnique(field.options)) return false;
  const isReference = field.fieldType === CUSTOM_FIELD_TYPE.REFERENCE;
  if (isReference !== (field.referenceEntity !== undefined)) return false;
  if (field.entityType === CUSTOM_FIELD_ENTITY_TYPE.offering)
    return field.offeringKind !== undefined;
  return field.offeringKind === undefined;
}

const createRequestSchema = z
  .strictObject({
    entityType: entityTypeSchema,
    offeringKind: offeringKindSchema.optional(),
    fieldKey: z.string().regex(FIELD_KEY_PATTERN),
    label: localizedTextSchema,
    fieldType: z.enum(CUSTOM_FIELD_TYPE),
    isRequired: z.boolean(),
    options: optionListSchema.optional(),
    optionLabels: z
      .record(z.string().trim().min(1).max(OPTION_MAX_LENGTH), localizedTextSchema)
      .optional(),
    validation: boundsSchema.optional(),
    referenceEntity: z.enum(["contact", "member"]).optional(),
    visibility: visibilitySchema,
    botAsk: z.boolean(),
    isSearchable: z.boolean(),
    isSensitive: z.boolean(),
    sortOrder: z.number().int().min(0).max(SORT_ORDER_MAX),
  })
  .refine(fieldIsConsistent);

export function parseCustomFieldCreateRequest(value: unknown): CustomFieldDefinitionCreateRequest {
  return createRequestSchema.parse(value);
}

export const customFieldDefinitionCreateRequestSchema = createRequestSchema;

const updateRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  label: localizedTextSchema.optional(),
  isRequired: z.boolean().optional(),
  options: optionListSchema.optional(),
  optionLabels: z
    .record(z.string().trim().min(1).max(OPTION_MAX_LENGTH), localizedTextSchema)
    .optional(),
  validation: boundsSchema.optional(),
  visibility: visibilitySchema.optional(),
  botAsk: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isSensitive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(SORT_ORDER_MAX).optional(),
});

export const customFieldDefinitionUpdateRequestSchema = updateRequestSchema;

export function toCustomFieldUpdateRequest(
  value: z.output<typeof updateRequestSchema>,
): CustomFieldDefinitionUpdateRequest {
  return value;
}

export const customFieldArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

export function toCustomFieldArchiveRequest(
  value: z.output<typeof customFieldArchiveRequestSchema>,
): CustomFieldArchiveRequest {
  return value;
}

const preferenceChangeSchema = z
  .strictObject({
    entityType: entityTypeSchema,
    offeringKind: offeringKindSchema.optional(),
    fieldKey: z.string().regex(FIELD_KEY_PATTERN),
    isHidden: z.boolean().optional(),
    label: localizedTextSchema.optional(),
    sortOrder: z.number().int().min(0).max(SORT_ORDER_MAX).optional(),
    version: z.number().int().positive().optional(),
  })
  .refine((value) => value.entityType === "offering" || value.offeringKind === undefined)
  .refine((value) => value.entityType !== "offering" || value.offeringKind !== undefined);

export const customFieldPreferenceBatchRequestSchema = z.strictObject({
  preferences: z.array(preferenceChangeSchema).min(1).max(PREFERENCE_BATCH_MAX),
});

export function toCustomFieldPreferenceBatch(
  value: z.output<typeof customFieldPreferenceBatchRequestSchema>,
): CustomFieldPreferenceBatchRequest {
  return value;
}

const listQuerySchema = paginationQuerySchema
  .extend({
    entityType: entityTypeSchema,
    offeringKind: offeringKindSchema.optional(),
  })
  .refine((value) => value.entityType === "offering" || value.offeringKind === undefined)
  .refine((value) => value.entityType !== "offering" || value.offeringKind !== undefined);

export const customFieldListQuerySchema = listQuerySchema;

export function toCustomFieldListQuery(
  value: z.output<typeof listQuerySchema>,
): CustomFieldListQuery {
  return value;
}

export const customFieldDefinitionParamsSchema = z.object({
  customFieldDefinitionId: uuidV7Schema,
});
