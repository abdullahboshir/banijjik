import { AUDIT_ACTION, ERROR_CODE } from "@banijjik/contracts";
import {
  SITE_PAGE_KEY,
  WEBSITE_EVENT_TYPE,
  type SitePageKey,
  type SitePageResponse,
  type SitePageUpsertRequest,
  type StorefrontSitePageResponse,
  type StorefrontSitePageSummary,
} from "@banijjik/contracts/website";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { AppError } from "../../../../../kernel/http/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { versionConflict } from "../../domain/errors.js";
import { SitePage, type SitePageContent } from "../../domain/site-page.entity.js";
import type { SitePageRepository } from "../ports/site-page-repository.js";
import type { WebsiteEventPublisher } from "../ports/website-ports.js";
import {
  blankSitePageResponse,
  sitePageKeyOrder,
  toSitePageResponse,
  toStorefrontSitePage,
  toStorefrontSitePageSummary,
} from "../site-page-views.js";

export interface SitePageUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface SitePageWriteDependencies {
  readonly pages: SitePageRepository;
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

/** Admin read: all six page keys, a missing one as a blank page (M.6a decision 1). */
export class ListSitePagesUseCase {
  constructor(private readonly pages: SitePageRepository) {}

  async execute(): Promise<SitePageResponse[]> {
    const stored = await this.pages.listAll();
    const byKey = new Map(stored.map((page) => [page.pageKey, page]));
    return Object.values(SITE_PAGE_KEY).map((pageKey) => {
      const page = byKey.get(pageKey);
      return page === undefined ? blankSitePageResponse(pageKey) : toSitePageResponse(page);
    });
  }
}

function contentOf(body: SitePageUpsertRequest): SitePageContent {
  return { title: body.title, body: body.body, isPublished: body.isPublished };
}

/** Create (version 0) or versioned update of one page. A stale version is a 409 and changes nothing. */
export class UpsertSitePageUseCase {
  constructor(private readonly dependencies: SitePageWriteDependencies) {}

  async execute(input: UpsertSitePageInput): Promise<SitePageResponse> {
    return this.dependencies.unitOfWork.run(async () => {
      const existing = await this.dependencies.pages.findByKey(input.pageKey);
      const saved =
        input.body.version === 0
          ? await this.createPage(input, existing)
          : await this.updatePage(input, existing);
      await this.recordChange(input, saved);
      return toSitePageResponse(saved);
    });
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
  private async recordChange(input: UpsertSitePageInput, saved: SitePage): Promise<void> {
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.SITE_PAGE_UPDATED,
      entityType: "sitePage",
      entityId: saved.sitePageId,
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
  constructor(private readonly pages: SitePageRepository) {}

  async execute(pageKey: SitePageKey): Promise<StorefrontSitePageResponse> {
    const page = await this.pages.findByKey(pageKey);
    if (page === undefined || !page.isPublished) {
      throw new AppError({
        code: ERROR_CODE.NOT_FOUND,
        messageKey: "errors.storefront_not_available",
      });
    }
    return toStorefrontSitePage(page);
  }
}

/** Published page titles in contract order, for the site read. */
export class ListPublishedSitePagesUseCase {
  constructor(private readonly pages: SitePageRepository) {}

  async execute(): Promise<StorefrontSitePageSummary[]> {
    const published = await this.pages.listPublished();
    return published
      .sort((left, right) => sitePageKeyOrder(left.pageKey) - sitePageKeyOrder(right.pageKey))
      .map(toStorefrontSitePageSummary);
  }
}
