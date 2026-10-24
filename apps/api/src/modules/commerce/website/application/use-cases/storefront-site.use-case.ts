import { FILE_VARIANT, publicFilePath } from "@banijjik/contracts/file";
import type {
  StorefrontSiteResponse,
  StorefrontSitePageSummary,
} from "@banijjik/contracts/website";
import type { StorefrontSiteSources } from "../ports/website-ports.js";
import type { ListPublishedSitePagesUseCase } from "./site-page.use-cases.js";

/**
 * The public site read (M.6a decision 2): branding, feature switches and published page titles.
 * Nothing else of the business leaves through it. Pages are listed only when the website is on.
 */
export class GetStorefrontSiteUseCase {
  constructor(
    private readonly sources: StorefrontSiteSources,
    private readonly publishedPages: ListPublishedSitePagesUseCase,
  ) {}

  async execute(organizationId: string): Promise<StorefrontSiteResponse | undefined> {
    const business = await this.sources.readBusiness(organizationId);
    if (business === undefined) return undefined;
    const features = await this.sources.readFeatures(organizationId);
    const pages: StorefrontSitePageSummary[] = features.website
      ? await this.publishedPages.execute()
      : [];
    return {
      organizationId: business.organizationId,
      name: business.name,
      tagline: business.tagline,
      logoUrl:
        business.logoFileId === null
          ? null
          : publicFilePath(business.logoFileId, FILE_VARIANT.medium),
      colors: { primary: business.primaryColor, accent: business.accentColor },
      features,
      pages,
    };
  }
}
