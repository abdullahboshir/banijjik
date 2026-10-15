import { OFFERING_KIND, type IndustryTemplateConfiguration } from "@banijjik/contracts";
import { z } from "zod";
import { industryTemplateKeySchema } from "../industry-template-key.schema.js";
import { versionSchema } from "../organization/organization-fields.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { industryTemplateConfigurationSchema } from "./industry-template-schemas.js";
import { reasonSchema } from "./platform-schemas.js";

const ICON_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 160;

const localizedNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  en: z.string().trim().min(1).max(NAME_MAX_LENGTH),
});

const localizedDescriptionSchema = z.strictObject({
  bn: z.string().trim().min(1).max(DESCRIPTION_MAX_LENGTH),
  en: z.string().trim().min(1).max(DESCRIPTION_MAX_LENGTH),
});

const kindsSchema = z.array(z.enum(OFFERING_KIND)).min(1);
const moduleKeysSchema = z.array(z.string().trim().min(1)).min(1);

interface CreateShape {
  readonly cloneFromIndustryTemplateId?: string | undefined;
  readonly enabledKinds?: readonly string[] | undefined;
  readonly allowedModuleKeys?: readonly string[] | undefined;
  readonly configuration?: unknown;
}

function hasOwnContent(value: CreateShape): boolean {
  return (
    value.enabledKinds !== undefined ||
    value.allowedModuleKeys !== undefined ||
    value.configuration !== undefined
  );
}

function createContentIsExclusive(value: CreateShape, context: z.RefinementCtx): void {
  const cloning = value.cloneFromIndustryTemplateId !== undefined;
  if (cloning && hasOwnContent(value)) {
    context.addIssue({ code: "custom", path: ["cloneFromIndustryTemplateId"] });
    return;
  }
  if (cloning) return;
  if (value.enabledKinds === undefined)
    context.addIssue({ code: "custom", path: ["enabledKinds"] });
  if (value.allowedModuleKeys === undefined) {
    context.addIssue({ code: "custom", path: ["allowedModuleKeys"] });
  }
  if (value.configuration === undefined) {
    context.addIssue({ code: "custom", path: ["configuration"] });
  }
}

const industryTemplateCreateObject = z.strictObject({
  industryTemplateKey: industryTemplateKeySchema,
  name: localizedNameSchema,
  description: localizedDescriptionSchema,
  iconKey: z.string().regex(ICON_KEY_PATTERN),
  reason: reasonSchema,
  enabledKinds: kindsSchema.optional(),
  allowedModuleKeys: moduleKeysSchema.optional(),
  configuration: industryTemplateConfigurationSchema.optional(),
  cloneFromIndustryTemplateId: uuidV7Schema.optional(),
});

/** Creates a DRAFT template, either from fields or by cloning an existing one. */
export const industryTemplateCreateRequestSchema =
  industryTemplateCreateObject.superRefine(createContentIsExclusive);

export type IndustryTemplateCreateBody = z.output<typeof industryTemplateCreateRequestSchema>;

/** Replaces the optional fields. The key and the status are not in the body. */
export const industryTemplateUpdateRequestSchema = z.strictObject({
  version: versionSchema,
  reason: reasonSchema,
  name: localizedNameSchema.optional(),
  description: localizedDescriptionSchema.optional(),
  iconKey: z.string().regex(ICON_KEY_PATTERN).optional(),
  enabledKinds: kindsSchema.optional(),
  allowedModuleKeys: moduleKeysSchema.optional(),
  configuration: industryTemplateConfigurationSchema.optional(),
});

export type IndustryTemplateUpdateBody = z.output<typeof industryTemplateUpdateRequestSchema>;

/** Body of publish and retire. */
export const industryTemplateStatusRequestSchema = z.strictObject({
  version: versionSchema,
  reason: reasonSchema,
});

export type IndustryTemplateStatusBody = z.output<typeof industryTemplateStatusRequestSchema>;

/** Moves an organization onto another template. */
export const changeIndustryTemplateRequestSchema = z.strictObject({
  industryTemplateKey: industryTemplateKeySchema,
  reason: reasonSchema,
});

export type ChangeIndustryTemplateBody = z.output<typeof changeIndustryTemplateRequestSchema>;

function listed<Item>(values: readonly Item[]): Item[] {
  return [...values];
}

/**
 * Copies a stored configuration into the shape a create or PATCH body accepts.
 * The schema parse is the copy: the result is the write schema's output, not a cast.
 */
export function toIndustryTemplateWriteConfiguration(
  configuration: IndustryTemplateConfiguration,
): z.output<typeof industryTemplateConfigurationSchema> {
  return industryTemplateConfigurationSchema.parse({
    contactRoleKeys: listed(configuration.contactRoleKeys),
    relationKeys: listed(configuration.relationKeys),
    resourceTypes: listed(configuration.resourceTypes),
    terms: { ...configuration.terms },
    customFields: listed(configuration.customFields),
    settingsDefaults: { ...configuration.settingsDefaults },
    ...(configuration.modifierGroupsSeed === undefined
      ? {}
      : { modifierGroupsSeed: listed(configuration.modifierGroupsSeed) }),
    knowledgeSeed: listed(configuration.knowledgeSeed),
    websiteTemplateKeys: listed(configuration.websiteTemplateKeys),
    botDefaults: {
      personaKey: configuration.botDefaults.personaKey,
      handoffTopics: listed(configuration.botDefaults.handoffTopics),
    },
  });
}
