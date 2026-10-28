import type {
  PublishedSiteDesign,
  PublishedSiteResponse,
  SiteDraftResponse,
} from "@banijjik/contracts/website";
import type { Site } from "../domain/site.entity.js";
import type { WebsiteVersion } from "../domain/website-version.entity.js";

/** The admin view of the site: the draft, the stored policy and the pointer, never a snapshot. */
export function toSiteDraftResponse(site: Site): SiteDraftResponse {
  return {
    siteId: site.siteId,
    version: site.version,
    publishedWebsiteVersionId: site.publishedWebsiteVersionId,
    design: site.draftDesign,
    policy: site.editPolicy,
  };
}

/** The public view of one snapshot. `publishedAt` is serialised so the DTO stays a plain JSON value. */
export function toPublishedSiteResponse(
  site: Site,
  version: WebsiteVersion,
  design: PublishedSiteDesign = version.design,
): PublishedSiteResponse {
  return {
    siteId: site.siteId,
    websiteVersionId: version.websiteVersionId,
    revision: version.revision,
    design,
    publishedAt: version.publishedAt.toISOString(),
  };
}
