import { ERROR_CODE } from "@banijjik/contracts";
import {
  type PublishedSiteResponse,
  type SiteDraftResponse,
  type SiteVersionListResponse,
} from "@banijjik/contracts/website";
import type { SiteId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { republishPublishedDesign } from "../../domain/site-projection.js";
import { toPublishedSiteResponse, toSiteDraftResponse } from "../site-views.js";
import type {
  SiteSectionAvailability,
  SiteVersionRepository,
} from "../ports/site-publication-ports.js";
import type { SiteRepository } from "../ports/site-repository.js";

export interface ReadSiteDependencies {
  readonly sites: SiteRepository;
  readonly versions: SiteVersionRepository;
  readonly sections: SiteSectionAvailability;
}

export interface ListSiteVersionsQuery {
  readonly page: number;
  readonly limit: number;
}

function notPublished(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.website_not_published",
  });
}

/** The version list is filtered by site, so the read starts from the organization's own site. */
async function currentSiteId(sites: SiteRepository): Promise<SiteId> {
  const site = await sites.findCurrent();
  if (site === undefined) throw new AppError({ code: ERROR_CODE.NOT_FOUND });
  return site.siteId;
}

/** `GET /site`: the draft, the stored policy and the pointer. Internal provenance stays inside. */
export class GetSiteDraftUseCase {
  constructor(private readonly sites: SiteRepository) {}

  async execute(): Promise<SiteDraftResponse> {
    const site = await this.sites.findCurrent();
    if (site === undefined) throw new AppError({ code: ERROR_CODE.NOT_FOUND });
    return toSiteDraftResponse(site);
  }
}

/** `GET /versions?page=&limit=`: one page of metadata, newest first, never the snapshots (P4-18). */
export class ListSiteVersionsUseCase {
  constructor(private readonly dependencies: Pick<ReadSiteDependencies, "sites" | "versions">) {}

  async execute(query: ListSiteVersionsQuery): Promise<SiteVersionListResponse> {
    const siteId = await currentSiteId(this.dependencies.sites);
    const listed = await this.dependencies.versions.listMetadata({ ...query, siteId });
    return {
      items: listed.items,
      page: query.page,
      limit: query.limit,
      total: listed.total,
    };
  }
}

/**
 * `GET /published-site`: what the public may see. The stored snapshot is re-projected through the
 * sections that are effective *now*, so a module switched off after publishing cannot leak (P4-12).
 * Nothing published is the same 404 as no site at all.
 */
export class GetPublishedSiteUseCase {
  constructor(private readonly dependencies: ReadSiteDependencies) {}

  async execute(): Promise<PublishedSiteResponse> {
    const site = await this.dependencies.sites.findCurrent();
    if (site === undefined || site.publishedWebsiteVersionId === null) throw notPublished();
    const version = await this.dependencies.versions.findById(site.publishedWebsiteVersionId);
    if (version === undefined) throw notPublished();
    const effectiveSectionKeys = await this.dependencies.sections.effectiveSectionKeys();
    const design = republishPublishedDesign({ design: version.design, effectiveSectionKeys });
    return toPublishedSiteResponse(site, version, design);
  }
}
