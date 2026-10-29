import type { MetadataRoute } from "next";
import { currentSiteResolution } from "../src/site/current-site";
import { buildRobotsMetadata } from "../src/site/site-metadata";

export const dynamic = "force-dynamic";

/**
 * Every host gets its own robots file.
 * Unknown hosts disallow all crawling.
 * Resolved hosts allow public pages, disallow API, customer and private routes, and reference the canonical sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const resolution = await currentSiteResolution();
  return buildRobotsMetadata(resolution?.canonicalHostname);
}
