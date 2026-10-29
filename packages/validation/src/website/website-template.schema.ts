import { MODULE_KEY, OFFERING_KIND } from "@banijjik/contracts";
import {
  SECTION_KEY,
  WEBSITE_PRESET_KEY_PATTERN,
  WEBSITE_TEMPLATE_KEY_PATTERN,
  WEBSITE_TEMPLATE_MAX_PRESETS,
  WEBSITE_TEMPLATE_MAX_REQUIRED_KINDS,
  WEBSITE_TEMPLATE_MAX_REQUIRED_MODULES,
  WEBSITE_TEMPLATE_STATUS,
  isRegisteredSectionVariant,
  isSectionKey,
} from "@banijjik/contracts/website";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { versionSchema } from "../organization/organization-fields.js";
import { reasonSchema } from "../platform/platform-schemas.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { siteDesignSchema, siteTokensSchema } from "./site-design.schema.js";
import { siteEditPolicySchema } from "./site-policy.schema.js";

const localizedNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(80),
  en: z.string().trim().min(1).max(80),
});

const localizedDescriptionSchema = z.strictObject({
  bn: z.string().trim().min(1).max(160),
  en: z.string().trim().min(1).max(160),
});

const presetKeySchema = z.string().regex(WEBSITE_PRESET_KEY_PATTERN);

const websiteDesignPresetSchema = z.strictObject({
  presetKey: presetKeySchema,
  name: localizedNameSchema,
  tokens: siteTokensSchema,
  sectionVariants: z.partialRecord(z.enum(SECTION_KEY), z.string().min(1).max(32)),
});

export const websiteTemplateContentSchema = z
  .strictObject({
    name: localizedNameSchema,
    description: localizedDescriptionSchema,
    requiredModules: z.array(z.enum(MODULE_KEY)).max(WEBSITE_TEMPLATE_MAX_REQUIRED_MODULES),
    requiredKinds: z.array(z.enum(OFFERING_KIND)).max(WEBSITE_TEMPLATE_MAX_REQUIRED_KINDS),
    defaultPresetKey: presetKeySchema,
    presets: z.array(websiteDesignPresetSchema).min(1).max(WEBSITE_TEMPLATE_MAX_PRESETS),
    design: siteDesignSchema,
    policy: siteEditPolicySchema,
  })
  .superRefine((content, context) => {
    const presetKeys = new Set<string>();
    content.presets.forEach((preset, index) => {
      if (presetKeys.has(preset.presetKey)) {
        context.addIssue({ code: "custom", path: ["presets", index, "presetKey"] });
      }
      presetKeys.add(preset.presetKey);
      for (const [sectionKey, variantKey] of Object.entries(preset.sectionVariants)) {
        if (isSectionKey(sectionKey) && isRegisteredSectionVariant(sectionKey, variantKey)) {
          continue;
        }
        context.addIssue({
          code: "custom",
          path: ["presets", index, "sectionVariants", sectionKey],
        });
      }
    });
    if (presetKeys.has(content.defaultPresetKey)) return;
    context.addIssue({ code: "custom", path: ["defaultPresetKey"] });
  })
  .superRefine((content, context) => {
    const section = findSectionWithImageFileId(content.design);
    if (section === undefined) return;
    context.addIssue({ code: "custom", path: ["design", section, "content", "imageFileId"] });
  });

function findSectionWithImageFileId(design: {
  readonly header: { readonly sectionId: string; readonly content: unknown };
  readonly footer: { readonly sectionId: string; readonly content: unknown };
  readonly pages: readonly {
    readonly sections: readonly { readonly sectionId: string; readonly content: unknown }[];
  }[];
}): string | undefined {
  const sections = [design.header, design.footer, ...design.pages.flatMap((page) => page.sections)];
  for (const section of sections) {
    if (containsImageFileId(section.content)) return section.sectionId;
  }
  return undefined;
}

function containsImageFileId(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return value.some(containsImageFileId);
  return Object.entries(value).some(([key, nested]) => {
    if (key === "imageFileId" && typeof nested === "string" && nested.length > 0) return true;
    return containsImageFileId(nested);
  });
}

export const createWebsiteTemplateRequestSchema = z.strictObject({
  templateKey: z.string().regex(WEBSITE_TEMPLATE_KEY_PATTERN),
  content: websiteTemplateContentSchema,
  reason: reasonSchema,
});
export type CreateWebsiteTemplateBody = z.output<typeof createWebsiteTemplateRequestSchema>;

export const updateWebsiteTemplateRequestSchema = z.strictObject({
  expectedVersion: versionSchema,
  content: websiteTemplateContentSchema,
  reason: reasonSchema,
});
export type UpdateWebsiteTemplateBody = z.output<typeof updateWebsiteTemplateRequestSchema>;

export const websiteTemplateStatusRequestSchema = z.strictObject({
  expectedVersion: versionSchema,
  reason: reasonSchema,
});
export type WebsiteTemplateStatusBody = z.output<typeof websiteTemplateStatusRequestSchema>;

export const platformWebsiteTemplateParamsSchema = z.strictObject({
  websiteTemplateId: uuidV7Schema,
});

export const platformWebsiteTemplateListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(WEBSITE_TEMPLATE_STATUS).optional(),
});
export type PlatformWebsiteTemplateListQuery = z.output<
  typeof platformWebsiteTemplateListQuerySchema
>;

export const platformWebsiteTemplateRevisionListQuerySchema = paginationQuerySchema.extend({
  websiteTemplateId: uuidV7Schema,
});
export type PlatformWebsiteTemplateRevisionListQuery = z.output<
  typeof platformWebsiteTemplateRevisionListQuerySchema
>;
