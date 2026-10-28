import { BRANDING_RULES } from "@banijjik/contracts";
import {
  PAGE_METADATA_KEY,
  REGION_LOCK,
  SECTION_KEY,
  SITE_DESIGN_BOUNDS,
  TOKEN_GROUP,
  isRegisteredSectionVariant,
  isSectionKey,
  type SectionKey,
} from "@banijjik/contracts/website";
import { z } from "zod";

const hexColorSchema = z
  .string()
  .regex(BRANDING_RULES.colorPattern)
  .transform((color) => color.toLowerCase());

const regionPolicySchema = z.strictObject({
  regionKey: z
    .string()
    .min(1)
    .max(SITE_DESIGN_BOUNDS.maxRegionKeyLength)
    .regex(/^[A-Za-z][A-Za-z0-9.-]*$/),
  lock: z.enum(REGION_LOCK),
  required: z.boolean(),
  sectionKeys: z.array(z.enum(SECTION_KEY)).max(Object.keys(SECTION_KEY).length),
  maxSections: z.number().int().min(1).max(SITE_DESIGN_BOUNDS.maxSectionsPerPage),
  editableContentKeys: z.array(z.string().min(1).max(64)).max(20),
});

const pageRulesSchema = z.strictObject({
  allowCreate: z.boolean(),
  allowDelete: z.boolean(),
  allowReorder: z.boolean(),
  allowPathChange: z.boolean(),
  editableMetadataKeys: z
    .array(z.enum(PAGE_METADATA_KEY))
    .max(Object.keys(PAGE_METADATA_KEY).length),
});

const tokenGroupsSchema = z.strictObject({
  color: z.boolean(),
  type: z.boolean(),
  shape: z.boolean(),
  spacing: z.boolean(),
  size: z.boolean(),
});

export const siteEditPolicySchema = z
  .strictObject({
    regions: z.array(regionPolicySchema).max(40),
    tokenGroups: tokenGroupsSchema,
    allowedColors: z.array(hexColorSchema).max(32).nullable(),
    allowedVariantsBySection: z.record(z.string(), z.array(z.string().min(1).max(32)).max(8)),
    pageRules: pageRulesSchema,
  })
  .superRefine((policy, context) => {
    addUnknownTokenGroupIssue(policy.tokenGroups, context);
    addVariantPaletteIssues(policy.allowedVariantsBySection, context);
  });

function addUnknownTokenGroupIssue(
  tokenGroups: Record<string, boolean>,
  context: z.RefinementCtx,
): void {
  for (const group of Object.keys(tokenGroups)) {
    if ((Object.values(TOKEN_GROUP) as readonly string[]).includes(group)) continue;
    context.addIssue({ code: "custom", path: ["tokenGroups", group] });
  }
}

function addVariantPaletteIssues(
  allowedVariantsBySection: Readonly<Record<string, readonly string[]>>,
  context: z.RefinementCtx,
): void {
  for (const [sectionKey, variants] of Object.entries(allowedVariantsBySection)) {
    if (!isSectionKey(sectionKey)) {
      context.addIssue({ code: "custom", path: ["allowedVariantsBySection", sectionKey] });
      continue;
    }
    addUnknownVariantIssues(sectionKey, variants, context);
  }
}

function addUnknownVariantIssues(
  sectionKey: SectionKey,
  variants: readonly string[],
  context: z.RefinementCtx,
): void {
  variants.forEach((variantKey, index) => {
    if (isRegisteredSectionVariant(sectionKey, variantKey)) return;
    context.addIssue({
      code: "custom",
      path: ["allowedVariantsBySection", sectionKey, index],
    });
  });
}
