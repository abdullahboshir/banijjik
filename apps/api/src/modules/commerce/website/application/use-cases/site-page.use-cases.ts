import { AUDIT_ACTION, ERROR_CODE } from "@banijjik/contracts";
import {
  SITE_PAGE_KEY,
  WEBSITE_EVENT_TYPE,
  type SiteDesign,
  type SitePageKey,
  type SitePageResponse,
  type SitePageUpsertRequest,
  type StaticPageDraft,
  type StorefrontSitePageResponse,
  type StorefrontSitePageSummary,
} from "@banijjik/contracts/website";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { AppError } from "../../../../../kernel/http/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { versionConflict } from "../../domain/errors.js";
import type { Site } from "../../domain/site.entity.js";
import { SitePage, type SitePageContent } from "../../domain/site-page.entity.js";
import { sitePolicyEvaluator } from "../../domain/site-policy.js";
import type { SitePageRepository } from "../ports/site-page-repository.js";
import type { SiteRepository } from "../ports/site-repository.js";
import type { WebsiteEventPublisher } from "../ports/website-ports.js";
import type { WebsiteVersionReader } from "../ports/website-version-reader.js";
import {
  blankStaticDraft,
  findStaticPage,
  importLegacyStaticPages,
  publicationStateOf,
  replaceStaticPage,
  sectionKeysOf,
  snapshotPagesIfPublished,
  summariesFromSnapshot,
} from "../site-page-bridge.js";
import {
  blankSitePageResponse,
  sitePageKeyOrder,
  toSitePageResponse,
  toSitePageResponseFromDraft,
  toStorefrontSitePage,
  toStorefrontSitePageSummary,
} from "../site-page-views.js";

export interface SitePageUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface SitePageWriteDependencies {
  readonly pages: SitePageRepository;
  readonly sites: SiteRepository;
  readonly unitOfWork: SitePageUnitOfWork;
  readonly events: WebsiteEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface UpsertSitePageInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly pageKey: SitePageKey;
  readonly body: SitePageUpsertRequest;
}

interface PageChangeRecord {
  readonly entityId: string;
  readonly isPublished: boolean;
  readonly version: number;
}

function storefrontUnavailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

function contentOf(body: SitePageUpsertRequest): SitePageContent {
  return { title: body.title, body: body.body, isPublished: body.isPublished };
}

function staticDraftOf(pageKey: SitePageKey, body: SitePageUpsertRequest): StaticPageDraft {
  return {
    pageKey,
    title: body.title,
    body: body.body,
    includeInPublication: body.isPublished,
  };
}

function publicationOf(site: Site) {
  return {
    publicationState: publicationStateOf({
      hasSite: true,
      hasPublishedOnce: site.hasPublishedOnce,
    }),
    siteVersion: site.version,
  };
}

function listedPage(input: {
  readonly pageKey: SitePageKey;
  readonly site: Site | undefined;
  readonly staticPages: readonly StaticPageDraft[];
  readonly legacyByKey: Map<SitePageKey, SitePage>;
}): SitePageResponse {
  const { pageKey, site, staticPages, legacyByKey } = input;
  if (site === undefined) {
    const legacy = legacyByKey.get(pageKey);
    return legacy === undefined ? blankSitePageResponse(pageKey) : toSitePageResponse(legacy);
  }
  const draft = staticPages.find((page) => page.pageKey === pageKey);
  if (draft !== undefined) {
    return toSitePageResponseFromDraft({
      page: draft,
      publicationState: publicationOf(site).publicationState,
      siteVersion: site.version,
      updatedAt: site.updatedAt,
    });
  }
  const legacy = !site.hasPublishedOnce ? legacyByKey.get(pageKey) : undefined;
  if (legacy !== undefined) {
    return toSitePageResponse(legacy, publicationOf(site));
  }
  return blankSitePageResponse(pageKey, publicationOf(site));
}

/** Admin read: all six page keys, a missing one as a blank page (M.6a decision 1). */
export class ListSitePagesUseCase {
  constructor(
    private readonly pages: SitePageRepository,
    private readonly sites: SiteRepository,
  ) {}

  async execute(): Promise<SitePageResponse[]> {
    const site = await this.sites.findCurrent();
    const stored = await this.pages.listAll();
    const legacyByKey = new Map(stored.map((page) => [page.pageKey, page]));
    const staticPages = site === undefined ? [] : site.draftDesign.staticContent;
    return Object.values(SITE_PAGE_KEY).map((pageKey) =>
      listedPage({ pageKey, site, staticPages, legacyByKey }),
    );
  }
}

/** Create (version 0) or versioned update of one page. A stale version is a 409 and changes nothing. */
export class UpsertSitePageUseCase {
  constructor(private readonly dependencies: SitePageWriteDependencies) {}

  async execute(input: UpsertSitePageInput): Promise<SitePageResponse> {
    return this.dependencies.unitOfWork.run(async () => {
      const site = await this.dependencies.sites.findCurrent();
      if (site === undefined) return this.saveLegacyPage(input);
      return this.saveThroughSite(input, site);
    });
  }

  private async saveLegacyPage(input: UpsertSitePageInput): Promise<SitePageResponse> {
    const existing = await this.dependencies.pages.findByKey(input.pageKey);
    const saved =
      input.body.version === 0
        ? await this.createPage(input, existing)
        : await this.updatePage(input, existing);
    await this.recordChange(input, {
      entityId: saved.sitePageId,
      isPublished: saved.isPublished,
      version: saved.version,
    });
    return toSitePageResponse(saved);
  }

  private async saveThroughSite(input: UpsertSitePageInput, site: Site): Promise<SitePageResponse> {
    if (input.body.siteVersion !== site.version) throw versionConflict();
    const previous = await this.draftBeforeEdit(site, input.pageKey);
    const next = replaceStaticPage(previous, staticDraftOf(input.pageKey, input.body));
    sitePolicyEvaluator.assertAllowed({
      previous,
      next,
      policy: site.editPolicy,
      effectiveSectionKeys: sectionKeysOf(previous),
    });
    const saved = site.replaceDraft({
      draftDesign: next,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.sites.save(saved, site.version);
    await this.recordChange(input, {
      entityId: saved.siteId,
      isPublished: input.body.isPublished,
      version: saved.version,
    });
    const draft =
      findStaticPage(saved.draftDesign, input.pageKey) ?? blankStaticDraft(input.pageKey);
    return toSitePageResponseFromDraft({
      page: draft,
      publicationState: publicationStateOf({
        hasSite: true,
        hasPublishedOnce: saved.hasPublishedOnce,
      }),
      siteVersion: saved.version,
      updatedAt: saved.updatedAt,
    });
  }

  private async draftBeforeEdit(site: Site, pageKey: SitePageKey): Promise<SiteDesign> {
    const legacyPages = site.hasPublishedOnce ? [] : await this.dependencies.pages.listAll();
    const imported = importLegacyStaticPages(site.draftDesign, legacyPages);
    if (findStaticPage(imported, pageKey) !== undefined) return imported;
    return replaceStaticPage(imported, blankStaticDraft(pageKey));
  }

  private async createPage(
    input: UpsertSitePageInput,
    existing: SitePage | undefined,
  ): Promise<SitePage> {
    if (existing !== undefined) throw versionConflict();
    const page = SitePage.create({
      organizationId: input.organizationId,
      pageKey: input.pageKey,
      content: contentOf(input.body),
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    const outcome = await this.dependencies.pages.insert(page);
    if (outcome === "duplicate") throw versionConflict();
    return page;
  }

  private async updatePage(
    input: UpsertSitePageInput,
    existing: SitePage | undefined,
  ): Promise<SitePage> {
    if (existing === undefined) throw versionConflict();
    const updated = existing.replaceContent({
      content: contentOf(input.body),
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.pages.save(updated, input.body.version);
    return updated;
  }

  /** The audit row and the event carry ids and flags only, never the page text (ADR-144). */
  private async recordChange(input: UpsertSitePageInput, saved: PageChangeRecord): Promise<void> {
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.SITE_PAGE_UPDATED,
      entityType: "sitePage",
      entityId: saved.entityId,
      changes: {
        pageKey: { to: input.pageKey },
        isPublished: { to: saved.isPublished },
      },
    });
    await this.dependencies.events.publish(
      WEBSITE_EVENT_TYPE.PAGE_UPDATED,
      { pageKey: input.pageKey, version: saved.version },
      { orderingKey: `website:${input.organizationId}` },
    );
  }
}

/** Storefront read of one page: a missing or unpublished page is 404, the same answer for both. */
export class GetPublishedSitePageUseCase {
  constructor(
    private readonly pages: SitePageRepository,
    private readonly sites: SiteRepository,
    private readonly versions: WebsiteVersionReader,
  ) {}

  async execute(pageKey: SitePageKey): Promise<StorefrontSitePageResponse> {
    const snapshot = await snapshotPagesIfPublished(this.sites, this.versions);
    if (snapshot !== undefined) {
      const page = snapshot.find((entry) => entry.pageKey === pageKey);
      if (page === undefined) throw storefrontUnavailable();
      return page;
    }
    const page = await this.pages.findByKey(pageKey);
    if (page === undefined || !page.isPublished) throw storefrontUnavailable();
    return toStorefrontSitePage(page);
  }
}

/** Published page titles in contract order, for the site read. */
export class ListPublishedSitePagesUseCase {
  constructor(
    private readonly pages: SitePageRepository,
    private readonly sites: SiteRepository,
    private readonly versions: WebsiteVersionReader,
  ) {}

  async execute(): Promise<StorefrontSitePageSummary[]> {
    const snapshot = await snapshotPagesIfPublished(this.sites, this.versions);
    if (snapshot !== undefined) return summariesFromSnapshot(snapshot);
    const published = await this.pages.listPublished();
    return published
      .sort((left, right) => sitePageKeyOrder(left.pageKey) - sitePageKeyOrder(right.pageKey))
      .map(toStorefrontSitePageSummary);
  }
}
