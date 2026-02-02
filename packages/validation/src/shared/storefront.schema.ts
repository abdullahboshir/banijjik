import { z } from "zod";
import { STOREFRONT_SECTION_TYPE_ENUM } from "@banijjik/contracts";

export const StorefrontSectionSchema = z.object({
  type: z.enum(STOREFRONT_SECTION_TYPE_ENUM),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  content: z.any(),
  order: z.number().default(0),
  isActive: z.boolean().default(true),
});

export const StorefrontSEOSchema = z.object({
  metaTitle: z.string().min(1),
  metaDescription: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  ogImage: z.string().optional(),
});

export const UpdateStorefrontSchema = z.object({
  organizationId: z.string().min(1),
  hero: z
    .object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      backgroundImage: z.string().optional(),
    })
    .optional(),
  about: z
    .object({
      title: z.string().min(1),
      description: z.string().min(1),
      image: z.string().optional(),
    })
    .optional(),
  sections: z.array(StorefrontSectionSchema).optional(),
  seo: StorefrontSEOSchema.optional(),
  customCss: z.string().optional(),
});
