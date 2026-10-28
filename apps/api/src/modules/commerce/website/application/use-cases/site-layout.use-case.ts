import { ERROR_CODE } from "@banijjik/contracts";
import {
  type SiteDesign,
  type SiteDraftResponse,
  type SiteLayoutPageRequest,
  type SiteLayoutResponse,
  type SitePage,
  type SiteThemeUpdateRequest,
} from "@banijjik/contracts/website";
import { newId, type UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { DomainRuleError } from "../../domain/errors.js";
import type { SiteRepository } from "../ports/site-repository.js";
import type { SiteSectionAvailability } from "../ports/site-publication-ports.js";
import type { Site } from "../../domain/site.entity.js";
import { currentSiteOf } from "./publish-site.use-case.js";
import { SaveSiteDraftUseCase } from "./save-site.use-case.js";

export interface SiteLayoutDependencies {
  readonly sites: SiteRepository;
  readonly sections: SiteSectionAvailability;
  readonly clock: Clock;
}

async function requireSite(sites: SiteRepository): Promise<Site> {
  const site = await sites.findCurrent();
  if (site === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
  return site;
}

/**
 * A part endpoint is a merge, not a patch: the request is folded into the stored document and the
 * whole result goes through the same full-document evaluator as `PATCH /site` (decision 4). The
 * caller's `expectedVersion` stays the CAS token, so a concurrent edit is refused before anything is
 * written.
 */
async function saveMerged(input: {
  readonly dependencies: SiteLayoutDependencies;
  readonly actorUserId: UserId;
  readonly expectedVersion: number;
  readonly design: SiteDesign;
}): Promise<SiteDraftResponse> {
  const save = new SaveSiteDraftUseCase({
    sites: input.dependencies.sites,
    clock: input.dependencies.clock,
  });
  return save.execute({
    actorUserId: input.actorUserId,
    effectiveSectionKeys: await input.dependencies.sections.effectiveSectionKeys(),
    body: { expectedVersion: input.expectedVersion, design: input.design },
  });
}

/** `GET /layout-pages`: the pages of the draft, without the policy or the rest of the document. */
export class ListSiteLayoutPagesUseCase {
  constructor(private readonly dependencies: Pick<SiteLayoutDependencies, "sites">) {}

  async execute(): Promise<SiteLayoutResponse> {
    const site = await requireSite(this.dependencies.sites);
    return { siteId: site.siteId, version: site.version, pages: site.draftDesign.pages };
  }
}

/** `PUT /theme` replaces the token block; every other part of the document is sent back unchanged. */
export class UpdateSiteThemeUseCase {
  constructor(private readonly dependencies: SiteLayoutDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly body: SiteThemeUpdateRequest;
  }): Promise<SiteDraftResponse> {
    const site = await currentSiteOf(this.dependencies.sites, input.body.expectedVersion);
    return saveMerged({
      dependencies: this.dependencies,
      actorUserId: input.actorUserId,
      expectedVersion: input.body.expectedVersion,
      design: { ...site.draftDesign, tokens: input.body.tokens },
    });
  }
}

/** `POST /layout-pages`: the id of a new page comes from `newId()`, never from the body. */
export class CreateSiteLayoutPageUseCase {
  constructor(private readonly dependencies: SiteLayoutDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly body: SiteLayoutPageRequest;
  }): Promise<SiteDraftResponse> {
    const site = await currentSiteOf(this.dependencies.sites, input.body.expectedVersion);
    const page: SitePage = { pageId: newId(), ...input.body.page };
    return saveMerged({
      dependencies: this.dependencies,
      actorUserId: input.actorUserId,
      expectedVersion: input.body.expectedVersion,
      design: { ...site.draftDesign, pages: [...site.draftDesign.pages, page] },
    });
  }
}

/** `PATCH /layout-pages/:pageId`: the path names the page, so a body cannot aim at another one. */
export class UpdateSiteLayoutPageUseCase {
  constructor(private readonly dependencies: SiteLayoutDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly pageId: string;
    readonly body: SiteLayoutPageRequest;
  }): Promise<SiteDraftResponse> {
    const site = await currentSiteOf(this.dependencies.sites, input.body.expectedVersion);
    const pages = site.draftDesign.pages;
    if (!pages.some((page) => page.pageId === input.pageId)) {
      throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    }
    const next: SiteDesign = {
      ...site.draftDesign,
      pages: pages.map((page) =>
        page.pageId === input.pageId ? { ...input.body.page, pageId: input.pageId } : page,
      ),
    };
    return saveMerged({
      dependencies: this.dependencies,
      actorUserId: input.actorUserId,
      expectedVersion: input.body.expectedVersion,
      design: next,
    });
  }
}
