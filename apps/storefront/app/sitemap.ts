import type { MetadataRoute } from "next";
import { readPublic } from "../src/api/storefront-api";
import { currentSiteResolution } from "../src/site/current-site";
import { buildSitemap } from "../src/site/site-metadata";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";

export const dynamic = "force-dynamic";

/**
 * Public pages only: the home page, search (if directory is enabled), and published static pages.
 * Constructed strictly from the trusted canonicalHostname without reading browser Host headers.
 * Directory listings and customer/admin/checkout routes are strictly excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resolution = await currentSiteResolution();
  if (resolution === undefined) return [];
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${resolution.organizationId}/site`);
  return buildSitemap({
    canonicalHostname: resolution.canonicalHostname,
    pages: site?.pages,
    directoryEnabled: site?.features.directory === true,
  });
}
