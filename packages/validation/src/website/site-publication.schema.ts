import { SITE_PAGE_KEY } from "@banijjik/contracts/website";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import {
  siteDesignSchema,
  sitePageSchema,
  siteTokensSchema,
  staticPageDraftSchema,
} from "./site-design.schema.js";

/**
 * Publication requests carry only the version the editor last read. The snapshot a restore copies is
 * named in the path, so the body cannot point at a different version (decision 4).
 */
export const publishSiteRequestSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
});

export const restoreSiteRequestSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
});

/** `PUT /theme` sends the whole token block, because a partial token set cannot be validated. */
export const siteThemeUpdateRequestSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  tokens: siteTokensSchema,
});

/**
 * `POST` and `PATCH /layout-pages[/:pageId]` send one page without its id: the id of a new page comes
 * from `newId()`, and the id of an edited page comes from the path, so a body cannot aim at another page.
 */
export const siteLayoutPageRequestSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  page: sitePageSchema.omit({ pageId: true }),
});

export const sitePageIdParamsSchema = z.object({ pageId: uuidV7Schema });

export const websiteVersionIdParamsSchema = z.object({ websiteVersionId: uuidV7Schema });

/** `/versions` lists projected metadata, so the only input is the page window (decision: bounded reads). */
export const siteVersionsQuerySchema = paginationQuerySchema;

/**
 * A snapshot read back from `website_versions` must decode as public content before it is served.
 * The draft-only `includeInPublication` flag is dropped from the shape and rejected as unknown (P4-12).
 */
export const publishedSiteDesignSchema = z.strictObject({
  ...siteDesignSchema.shape,
  staticContent: z
    .array(staticPageDraftSchema.omit({ includeInPublication: true }))
    .max(Object.keys(SITE_PAGE_KEY).length),
});
