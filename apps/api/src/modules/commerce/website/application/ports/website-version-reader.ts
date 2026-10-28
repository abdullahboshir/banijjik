import type { StorefrontSitePageResponse } from "@banijjik/contracts/website";
import type { WebsiteVersionId } from "@banijjik/ids";

/** Published snapshot pages. Undefined means the version row is missing. */
export interface WebsiteVersionReader {
  findStaticPages(
    websiteVersionId: WebsiteVersionId,
  ): Promise<readonly StorefrontSitePageResponse[] | undefined>;
}
