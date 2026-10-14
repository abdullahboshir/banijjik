import {
  CONTACT_ROLE,
  CUSTOM_FIELD_TYPE,
  INDUSTRY_TEMPLATE_STATUS,
  OFFERING_KIND,
  RELATION_KEY,
  type IndustryTemplateConfiguration,
} from "@banijjik/contracts";
import { z } from "zod";
import { industryTemplateKeySchema } from "../industry-template-key.schema.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const TERM_KEY_PATTERN = /^[a-z]+(\.[A-Z]+)?$/;
const SETTING_KEY_PATTERN = /^[a-z]+(\.[a-zA-Z]+)+$/;
const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const ICON_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESOURCE_TYPE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,39}$/;
const TOPIC_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,39}$/;
const PLAIN_TEXT_MAX = 160;
const OPTION_MAX = 40;

const localizedTextSchema = z.strictObject({
  bn: z.string().trim().min(1).max(PLAIN_TEXT_MAX),
  en: z.string().trim().min(1).max(PLAIN_TEXT_MAX),
});

const contactLinkSchema = z.strictObject({
  relationKey: z.enum(RELATION_KEY),
  createIfMissingByPhone: z.boolean(),
  defaultBillTo: z.boolean(),
});

const customFieldSchema = z.strictObject({
  entityType: z.string().regex(/^[a-z][a-z_]{0,39}$/),
  offeringKind: z.enum(OFFERING_KIND).optional(),
  fieldKey: z.string().regex(FIELD_KEY_PATTERN),
  fieldType: z.enum(CUSTOM_FIELD_TYPE),
  isRequired: z.boolean(),
  botAsk: z.boolean(),
  visibility: z.strictObject({
    admin: z.boolean(),
    storefront: z.boolean(),
    bot: z.boolean(),
  }),
  isSearchable: z.boolean(),
  isSensitive: z.boolean(),
  options: z.array(z.string().trim().min(1).max(OPTION_MAX)).optional(),
  label: localizedTextSchema.optional(),
  optionLabels: z.record(z.string().trim().min(1).max(OPTION_MAX), localizedTextSchema).optional(),
  referenceEntity: z.enum(["contact", "member"]).optional(),
  link: contactLinkSchema.optional(),
});

const modifierOptionSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  priceDeltaMinor: z.number().int().nonnegative(),
});

const modifierGroupSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  selection: z.enum(["SINGLE", "MULTIPLE"]),
  isRequired: z.boolean(),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().nonnegative(),
  options: z.array(modifierOptionSchema).min(1),
});

const resourceTypeSchema = z.strictObject({
  resourceTypeKey: z.string().regex(RESOURCE_TYPE_KEY_PATTERN),
  termKey: z.string().regex(TERM_KEY_PATTERN),
  isMember: z.boolean(),
});

interface FieldShape {
  readonly fieldType: string;
  readonly entityType: string;
  readonly offeringKind?: string | undefined;
  readonly options?: readonly string[] | undefined;
  readonly optionLabels?: Readonly<Record<string, unknown>> | undefined;
  readonly referenceEntity?: string | undefined;
  readonly link?: unknown;
}

/** SELECT needs options; REFERENCE needs a target; other types carry neither. */
function customFieldIsConsistent(field: FieldShape): boolean {
  const needsOptions = field.fieldType === "SELECT" || field.fieldType === "MULTI_SELECT";
  const hasOptions = field.options !== undefined && field.options.length > 0;
  if (needsOptions !== hasOptions) return false;
  const isReference = field.fieldType === CUSTOM_FIELD_TYPE.REFERENCE;
  if (isReference && field.referenceEntity === undefined) return false;
  if (!isReference && (field.referenceEntity !== undefined || field.link !== undefined))
    return false;
  if (field.entityType === "offering") return field.offeringKind !== undefined;
  return field.offeringKind === undefined;
}

function optionLabelsMatch(field: FieldShape): boolean {
  if (field.optionLabels === undefined) return true;
  const options = field.options ?? [];
  const keys = Object.keys(field.optionLabels);
  if (keys.length !== options.length) return false;
  return options.every((option) => field.optionLabels?.[option] !== undefined);
}

function linkMatchesReference(field: FieldShape): boolean {
  if (field.link === undefined) return true;
  return field.referenceEntity === "contact";
}

export const industryTemplateConfigurationSchema = z
  .strictObject({
    contactRoleKeys: z.array(z.enum(CONTACT_ROLE)).min(1),
    relationKeys: z.array(z.enum(RELATION_KEY)),
    resourceTypes: z.array(resourceTypeSchema),
    terms: z.record(z.string().regex(TERM_KEY_PATTERN), localizedTextSchema),
    customFields: z.array(customFieldSchema),
    settingsDefaults: z.record(z.string().regex(SETTING_KEY_PATTERN), z.unknown()),
    modifierGroupsSeed: z.array(modifierGroupSchema).optional(),
    knowledgeSeed: z
      .array(
        z.strictObject({
          topicKey: z.string().regex(TOPIC_KEY_PATTERN),
          answer: localizedTextSchema,
        }),
      )
      .min(1),
    websiteTemplateKeys: z.array(z.string().regex(ICON_KEY_PATTERN)).min(1),
    botDefaults: z.strictObject({
      personaKey: z.string().regex(TOPIC_KEY_PATTERN),
      handoffTopics: z.array(z.string().trim().min(1).max(PLAIN_TEXT_MAX)).min(1),
    }),
  })
  .refine((value) => new Set(value.contactRoleKeys).size === value.contactRoleKeys.length, {
    path: ["contactRoleKeys"],
  })
  .refine((value) => new Set(value.relationKeys).size === value.relationKeys.length, {
    path: ["relationKeys"],
  })
  .refine(
    (value) => value.resourceTypes.every((resource) => value.terms[resource.termKey] !== undefined),
    { path: ["resourceTypes"] },
  )
  .refine((value) => value.customFields.every(customFieldIsConsistent), { path: ["customFields"] })
  .refine((value) => value.customFields.every(optionLabelsMatch), { path: ["customFields"] })
  .refine((value) => value.customFields.every(linkMatchesReference), { path: ["customFields"] })
  .refine(
    (value) =>
      value.modifierGroupsSeed === undefined ||
      value.modifierGroupsSeed.every((group) => group.maxSelect >= group.minSelect),
    { path: ["modifierGroupsSeed"] },
  );

export type IndustryTemplateConfigurationOutput = z.output<
  typeof industryTemplateConfigurationSchema
>;

/** The schema output is the contracts configuration. A mismatch fails this assignment. */
export function toIndustryTemplateConfiguration(
  value: IndustryTemplateConfigurationOutput,
): IndustryTemplateConfiguration {
  return value;
}

const localizedNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(80),
  en: z.string().trim().min(1).max(80),
});

/** One seed file: the aggregate fields plus a configuration the schema already checked. */
export const industryTemplateSeedSchema = z.strictObject({
  industryTemplateKey: industryTemplateKeySchema,
  status: z.enum(INDUSTRY_TEMPLATE_STATUS),
  name: localizedNameSchema,
  description: localizedTextSchema,
  iconKey: z.string().regex(ICON_KEY_PATTERN),
  enabledKinds: z.array(z.enum(OFFERING_KIND)).min(1),
  allowedModuleKeys: z.array(z.string()).min(1),
  configuration: industryTemplateConfigurationSchema,
});

export type IndustryTemplateSeed = z.output<typeof industryTemplateSeedSchema>;

export const platformIndustryTemplateListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(INDUSTRY_TEMPLATE_STATUS).optional(),
});

export type PlatformIndustryTemplateListQuery = z.output<
  typeof platformIndustryTemplateListQuerySchema
>;

export const platformIndustryTemplateParamsSchema = z.object({
  industryTemplateId: uuidV7Schema,
});
