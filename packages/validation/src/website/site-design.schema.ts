import { BRAND_CHECKS, BRANDING_RULES } from "@banijjik/contracts";
import {
  BORDER_TOKEN,
  CARD_SIZE_TOKEN,
  DENSITY_TOKEN,
  FONT_PAIR_KEY,
  IMAGE_RATIO_TOKEN,
  RADIUS_TOKEN,
  SHADOW_TOKEN,
  SITE_DESIGN_BOUNDS,
  SITE_PAGE_BODY_MAX_LENGTH,
  SITE_PAGE_KEY,
  SITE_PAGE_TITLE_MAX_LENGTH,
  SITE_TOKEN_CONTRAST_PAIRS,
  SECTION_KEY,
  SECTION_VARIANTS,
  TYPE_SCALE,
  containsUnsafeContent,
  isAllowedPublicHref,
  isReservedPublicPath,
  isStaticSectionKey,
  type SectionKey,
} from "@banijjik/contracts/website";
import { z } from "zod";
import { emailSchema } from "../email.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const { maxEncodedBytes, maxPages, maxSectionsPerPage, maxMenuLinks } = SITE_DESIGN_BOUNDS;

const hexColorSchema = z
  .string()
  .regex(BRANDING_RULES.colorPattern)
  .transform((color) => color.toLowerCase());

const regionKeySchema = z
  .string()
  .min(1)
  .max(SITE_DESIGN_BOUNDS.maxRegionKeyLength)
  .regex(/^[A-Za-z][A-Za-z0-9.-]*$/);

function localizedTextSchema(maxLength: number) {
  return z
    .strictObject({
      bn: z.string().max(maxLength),
      en: z.string().max(maxLength),
    })
    .superRefine((text, context) => {
      addUnsafeTextIssue(text.bn, context, ["bn"]);
      addUnsafeTextIssue(text.en, context, ["en"]);
    });
}

function addUnsafeTextIssue(
  value: string,
  context: z.RefinementCtx,
  path: readonly (string | number)[],
) {
  if (!containsUnsafeContent(value)) return;
  context.addIssue({ code: "custom", path: [...path] });
}

function publicHrefSchema() {
  return z.string().trim().min(1).max(SITE_DESIGN_BOUNDS.maxPathLength).refine(isAllowedPublicHref);
}

const menuLinkSchema = z.strictObject({
  label: localizedTextSchema(SITE_DESIGN_BOUNDS.maxLinkLabelLength),
  path: publicHrefSchema(),
});

const dynamicBindingSchema = z.strictObject({
  categoryId: uuidV7Schema.optional(),
  offeringIds: z.array(uuidV7Schema).max(SITE_DESIGN_BOUNDS.maxOfferingIds).optional(),
  locationId: uuidV7Schema.optional(),
  limit: z.number().int().min(1).max(SITE_DESIGN_BOUNDS.maxBindingLimit),
});

function contentSchemaFor(sectionKey: SectionKey) {
  const heading = localizedTextSchema(SITE_DESIGN_BOUNDS.maxHeadingLength);
  if (sectionKey === "header" || sectionKey === "footer") {
    return z.strictObject({ links: z.array(menuLinkSchema).max(maxMenuLinks) });
  }
  if (sectionKey === "hero") return heroContentSchema(heading);
  if (sectionKey === "rich-text") {
    return z.strictObject({ body: localizedTextSchema(SITE_DESIGN_BOUNDS.maxRichTextLength) });
  }
  if (sectionKey === "faq") return faqContentSchema();
  if (sectionKey === "testimonials") return testimonialContentSchema();
  if (sectionKey === "contact") return contactContentSchema(heading);
  return z.strictObject({ heading });
}

function heroContentSchema(heading: z.ZodType) {
  return z.strictObject({
    heading,
    body: localizedTextSchema(SITE_DESIGN_BOUNDS.maxHeroBodyLength),
    imageFileId: uuidV7Schema.optional(),
    actionLabel: localizedTextSchema(SITE_DESIGN_BOUNDS.maxLinkLabelLength).optional(),
    actionPath: publicHrefSchema().optional(),
  });
}

function faqContentSchema() {
  return z.strictObject({
    entries: z
      .array(
        z.strictObject({
          question: localizedTextSchema(SITE_DESIGN_BOUNDS.maxFaqQuestionLength),
          answer: localizedTextSchema(SITE_DESIGN_BOUNDS.maxFaqAnswerLength),
        }),
      )
      .max(SITE_DESIGN_BOUNDS.maxFaqEntries),
  });
}

function testimonialContentSchema() {
  return z.strictObject({
    entries: z
      .array(
        z.strictObject({
          quote: localizedTextSchema(SITE_DESIGN_BOUNDS.maxQuoteLength),
          attribution: localizedTextSchema(SITE_DESIGN_BOUNDS.maxAttributionLength),
        }),
      )
      .max(SITE_DESIGN_BOUNDS.maxTestimonialEntries),
  });
}

function contactContentSchema(heading: z.ZodType) {
  return z.strictObject({
    heading,
    phone: phoneE164Schema.optional(),
    email: emailSchema.optional(),
    address: localizedTextSchema(SITE_DESIGN_BOUNDS.maxAddressLength).optional(),
  });
}

function sectionSchemaFor(sectionKey: SectionKey) {
  const variants = SECTION_VARIANTS[sectionKey];
  const binding = isStaticSectionKey(sectionKey) ? z.null() : dynamicBindingSchema;
  return z.strictObject({
    sectionId: uuidV7Schema,
    sectionKey: z.literal(sectionKey),
    variantKey: z.enum(variants),
    regionKey: regionKeySchema,
    binding,
    content: contentSchemaFor(sectionKey),
  });
}

function siteSectionUnionSchema() {
  const [firstSchema, ...otherSchemas] = Object.values(SECTION_KEY).map(sectionSchemaFor);
  if (firstSchema === undefined) {
    throw new Error("website section registry is empty");
  }
  return z.discriminatedUnion("sectionKey", [firstSchema, ...otherSchemas]);
}

const siteSectionSchema = siteSectionUnionSchema();

export const siteTokensSchema = z
  .strictObject({
    color: z.strictObject({
      primary: hexColorSchema,
      accent: hexColorSchema,
      background: hexColorSchema,
      surface: hexColorSchema,
      text: hexColorSchema,
      mutedText: hexColorSchema,
      onPrimary: hexColorSchema,
      focus: hexColorSchema,
    }),
    type: z.strictObject({
      fontPairKey: z.enum(FONT_PAIR_KEY),
      scale: z.enum(TYPE_SCALE),
    }),
    shape: z.strictObject({
      cardRadius: z.enum(RADIUS_TOKEN),
      buttonRadius: z.enum(RADIUS_TOKEN),
      inputRadius: z.enum(RADIUS_TOKEN),
      imageRadius: z.enum(RADIUS_TOKEN),
      border: z.enum(BORDER_TOKEN),
      shadow: z.enum(SHADOW_TOKEN),
    }),
    spacing: z.strictObject({ density: z.enum(DENSITY_TOKEN) }),
    size: z.strictObject({
      imageRatio: z.enum(IMAGE_RATIO_TOKEN),
      cardSize: z.enum(CARD_SIZE_TOKEN),
      columns: z.strictObject({
        mobile: z.union([z.literal(1), z.literal(2)]),
        tablet: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        desktop: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      }),
    }),
  })
  .superRefine((tokens, context) => addContrastIssues(tokens.color, context));

function addContrastIssues(color: Record<string, string>, context: z.RefinementCtx): void {
  for (const pair of SITE_TOKEN_CONTRAST_PAIRS) {
    const foreground = color[pair.foreground];
    const background = color[pair.background];
    if (foreground === undefined || background === undefined) continue;
    if (BRAND_CHECKS.contrastRatio(foreground, background) >= pair.minRatio) continue;
    context.addIssue({ code: "custom", path: ["color", pair.foreground] });
  }
}

const pagePathSchema = publicHrefSchema().refine(
  (path) => path.startsWith("/") && !path.startsWith("//") && !isReservedPublicPath(path),
);

export const sitePageSchema = z.strictObject({
  pageId: uuidV7Schema,
  path: pagePathSchema,
  title: localizedTextSchema(SITE_PAGE_TITLE_MAX_LENGTH),
  seo: z.strictObject({
    description: localizedTextSchema(SITE_DESIGN_BOUNDS.maxHeroBodyLength),
    noIndex: z.boolean(),
  }),
  sections: z.array(siteSectionSchema).max(maxSectionsPerPage),
});

export const staticPageDraftSchema = z.strictObject({
  pageKey: z.enum(SITE_PAGE_KEY),
  title: localizedTextSchema(SITE_PAGE_TITLE_MAX_LENGTH),
  body: localizedTextSchema(SITE_PAGE_BODY_MAX_LENGTH),
  includeInPublication: z.boolean(),
});

export const siteDesignSchema = z
  .strictObject({
    schemaVersion: z.literal(SITE_DESIGN_BOUNDS.schemaVersion),
    tokens: siteTokensSchema,
    header: sectionSchemaFor("header").refine((section) => section.regionKey === "header"),
    footer: sectionSchemaFor("footer").refine((section) => section.regionKey === "footer"),
    pages: z.array(sitePageSchema).max(maxPages),
    staticContent: z.array(staticPageDraftSchema).max(Object.keys(SITE_PAGE_KEY).length),
  })
  .superRefine((design, context) => {
    addUniquePagePathIssues(design.pages, context);
    addUniqueSectionIdIssues(design, context);
    addMenuLinkCountIssue(design, context);
    addEncodedSizeIssue(design, context);
  });

function addUniquePagePathIssues(
  pages: readonly { path: string }[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  pages.forEach((page, index) => {
    if (seen.has(page.path)) context.addIssue({ code: "custom", path: ["pages", index, "path"] });
    seen.add(page.path);
  });
}

function collectSectionIds(design: {
  header: { sectionId: string };
  footer: { sectionId: string };
  pages: readonly { sections: readonly { sectionId: string }[] }[];
}): string[] {
  return [
    design.header.sectionId,
    design.footer.sectionId,
    ...design.pages.flatMap((page) => page.sections.map((section) => section.sectionId)),
  ];
}

function addUniqueSectionIdIssues(
  design: {
    header: { sectionId: string };
    footer: { sectionId: string };
    pages: readonly { sections: readonly { sectionId: string }[] }[];
  },
  context: z.RefinementCtx,
): void {
  const ids = collectSectionIds(design);
  if (new Set(ids).size === ids.length) return;
  context.addIssue({ code: "custom", path: ["header", "sectionId"] });
}

function linkCount(content: unknown): number {
  if (typeof content !== "object" || content === null) return 0;
  if (!("links" in content) || !Array.isArray(content.links)) return 0;
  return content.links.length;
}

function addMenuLinkCountIssue(
  design: { header: { content: unknown }; footer: { content: unknown } },
  context: z.RefinementCtx,
): void {
  if (linkCount(design.header.content) + linkCount(design.footer.content) <= maxMenuLinks) return;
  context.addIssue({ code: "custom", path: ["header", "content", "links"] });
}

function addEncodedSizeIssue(design: unknown, context: z.RefinementCtx): void {
  const encoded = JSON.stringify(design);
  if (encoded.length <= maxEncodedBytes) return;
  context.addIssue({ code: "custom", path: ["pages"] });
}

export const saveSiteDraftRequestSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  design: siteDesignSchema,
});
