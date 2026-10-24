import type { StorefrontSiteResponse } from "@banijjik/contracts/website";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { readPublic } from "../src/api/storefront-api";
import { PAGE_PATH_PREFIX, slugOfPageKey } from "../src/pages/page-routes";
import { requireOrganizationId } from "../src/site/current-site";

const HTTPS = "https";

/** Public pages only: the home page, search, and published static pages. Listings and sign-in are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const organizationId = await requireOrganizationId();
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${organizationId}/site`);
  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? HTTPS}://${requestHeaders.get("host") ?? ""}`;
  const pageUrls = (site?.pages ?? []).map((page) => ({
    url: `${origin}${PAGE_PATH_PREFIX}/${slugOfPageKey(page.pageKey)}`,
  }));
  const searchUrls = site?.features.directory === true ? [{ url: `${origin}/search` }] : [];
  return [{ url: `${origin}/` }, ...searchUrls, ...pageUrls];
}
