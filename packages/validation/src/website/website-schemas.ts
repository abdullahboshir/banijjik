import {
  SITE_PAGE_BODY_MAX_LENGTH,
  SITE_PAGE_KEY,
  SITE_PAGE_TITLE_MAX_LENGTH,
} from "@banijjik/contracts/website";
import { z } from "zod";

/**
 * A title may be empty in one language; a published page needs one non-empty title (M.6a decision 1).
 * Each locale is bounded on its own, so the text is never cut silently.
 */
const pageTitleSchema = z.strictObject({
  bn: z.string().trim().max(SITE_PAGE_TITLE_MAX_LENGTH),
  en: z.string().trim().max(SITE_PAGE_TITLE_MAX_LENGTH),
});

const pageBodySchema = z.strictObject({
  bn: z.string().max(SITE_PAGE_BODY_MAX_LENGTH),
  en: z.string().max(SITE_PAGE_BODY_MAX_LENGTH),
});

/** Path params only: the router also carries `organizationId`, so this is not strict (as the credit params). */
export const sitePageKeyParamsSchema = z.object({
  pageKey: z.enum(SITE_PAGE_KEY),
});

export const sitePageUpsertRequestSchema = z
  .strictObject({
    title: pageTitleSchema,
    body: pageBodySchema,
    isPublished: z.boolean(),
    version: z.number().int().nonnegative(),
  })
  .refine((page) => !page.isPublished || page.title.bn.length > 0 || page.title.en.length > 0, {
    path: ["title"],
  });
