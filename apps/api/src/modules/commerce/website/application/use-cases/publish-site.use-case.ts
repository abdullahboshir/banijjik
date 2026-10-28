import { AUDIT_ACTION, ERROR_CODE } from "@banijjik/contracts";
import {
  WEBSITE_EVENT_TYPE,
  type PublishSiteRequest,
  type PublishedSiteResponse,
  type SiteDesign,
  type SiteDraftResponse,
} from "@banijjik/contracts/website";
import type { UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { DomainRuleError, versionConflict } from "../../domain/errors.js";
import { collectImageFileIds, projectPublishedDesign } from "../../domain/site-projection.js";
import { sitePolicyEvaluator } from "../../domain/site-policy.js";
import type { Site } from "../../domain/site.entity.js";
import { WebsiteVersion } from "../../domain/website-version.entity.js";
import { toPublishedSiteResponse, toSiteDraftResponse } from "../site-views.js";
import type {
  SiteMediaChecker,
  SitePublicationEventPublisher,
  SitePublicationUnitOfWork,
  SiteSectionAvailability,
  SiteVersionRepository,
} from "../ports/site-publication-ports.js";
import type { SiteRepository } from "../ports/site-repository.js";

export interface SitePublicationDependencies {
  readonly sites: SiteRepository;
  readonly versions: SiteVersionRepository;
  readonly images: SiteMediaChecker;
  readonly sections: SiteSectionAvailability;
  readonly unitOfWork: SitePublicationUnitOfWork;
  readonly events: SitePublicationEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** The command body carries one thing: the version the editor read. Everything else is stored state. */
export interface PublishSiteInput {
  readonly actorUserId: UserId;
  readonly body: PublishSiteRequest;
}

/** Events of one site are ordered per organization, the same key the page writes use (ADR-115). */
function orderingKeyOf(site: Site): string {
  return `website:${site.organizationId}`;
}

/** Every publication command reads the site through the same two guards: it exists, and the caller is current. */
export async function currentSiteOf(sites: SiteRepository, expectedVersion: number): Promise<Site> {
  const site = await sites.findCurrent();
  if (site === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
  if (site.version !== expectedVersion) throw versionConflict();
  return site;
}

/**
 * An image the organization may not show publicly stops the write (decision 6). Restore runs the same
 * check, because a historical snapshot can point at a file that was deleted or never belonged here.
 */
export async function assertPublicationImages(
  images: SiteMediaChecker,
  design: SiteDesign,
): Promise<void> {
  const fileIds = collectImageFileIds(design);
  if (fileIds.length === 0) return;
  const usable = await images.filterUsable(fileIds);
  const refused = fileIds.filter((fileId) => !usable.has(fileId));
  if (refused.length === 0) return;
  throw new DomainRuleError({
    code: ERROR_CODE.WEBSITE_REFERENCE_INVALID,
    details: { reason: "unusable_image", fileIds: refused },
  });
}

/**
 * Publishing a site (card 4.1 decision 2). The whole document is re-checked against the *current*
 * policy and the current modules before anything is written, and the snapshot, the pointer, the audit
 * row and the outbox event commit in one transaction, so a reader never sees a half-save.
 */
export class PublishSiteUseCase {
  constructor(private readonly dependencies: SitePublicationDependencies) {}

  async execute(input: PublishSiteInput): Promise<PublishedSiteResponse> {
    const site = await currentSiteOf(this.dependencies.sites, input.body.expectedVersion);
    const effectiveSectionKeys = await this.dependencies.sections.effectiveSectionKeys();
    sitePolicyEvaluator.assertAllowed({
      previous: site.draftDesign,
      next: site.draftDesign,
      policy: site.editPolicy,
      effectiveSectionKeys,
    });
    await assertPublicationImages(this.dependencies.images, site.draftDesign);
    const now = this.dependencies.clock.now();
    const version = WebsiteVersion.create({
      organizationId: site.organizationId,
      siteId: site.siteId,
      revision: site.nextRevision,
      design: projectPublishedDesign({ design: site.draftDesign, effectiveSectionKeys }),
      sourceTemplateKey: site.sourceTemplateKey,
      sourceTemplateRevision: site.sourceTemplateRevision,
      publishedByUserId: input.actorUserId,
      now,
    });
    const published = site.markPublished({
      websiteVersionId: version.websiteVersionId,
      now,
      actorUserId: input.actorUserId,
    });
    return this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.sites.save(published, input.body.expectedVersion);
      const outcome = await this.dependencies.versions.insert(version);
      if (outcome === "duplicate") throw versionConflict();
      await this.record(site, version);
      return toPublishedSiteResponse(published, version);
    });
  }

  /** The audit row and the outbox event name identifiers only, never the design (decision 15). */
  private async record(site: Site, version: WebsiteVersion): Promise<void> {
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.SITE_PUBLISHED,
      entityType: "site",
      entityId: site.siteId,
      changes: {
        websiteVersionId: { to: version.websiteVersionId },
        revision: { to: version.revision },
      },
    });
    await this.dependencies.events.publish(
      WEBSITE_EVENT_TYPE.SITE_PUBLISHED,
      {
        siteId: site.siteId,
        websiteVersionId: version.websiteVersionId,
        revision: version.revision,
      },
      { orderingKey: orderingKeyOf(site) },
    );
  }
}

/**
 * Explicit unpublish (4.1 audit correction): the public pointer clears in a transaction, the history
 * and the one-way `hasPublishedOnce` flag stay, and the legacy page fallback never returns.
 */
export class UnpublishSiteUseCase {
  constructor(private readonly dependencies: SitePublicationDependencies) {}

  async execute(input: PublishSiteInput): Promise<SiteDraftResponse> {
    const site = await currentSiteOf(this.dependencies.sites, input.body.expectedVersion);
    if (site.publishedWebsiteVersionId === null) {
      throw new DomainRuleError({
        code: ERROR_CODE.BUSINESS_RULE,
        details: { reason: "not_published" },
      });
    }
    const version = await this.dependencies.versions.findById(site.publishedWebsiteVersionId);
    if (version === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    const unpublished = site.markUnpublished({
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.sites.save(unpublished, input.body.expectedVersion);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.SITE_UNPUBLISHED,
        entityType: "site",
        entityId: site.siteId,
        changes: {
          websiteVersionId: { from: version.websiteVersionId, to: null },
          revision: { from: version.revision, to: null },
        },
      });
      await this.dependencies.events.publish(
        WEBSITE_EVENT_TYPE.SITE_UNPUBLISHED,
        {
          siteId: site.siteId,
          websiteVersionId: version.websiteVersionId,
          revision: version.revision,
        },
        { orderingKey: orderingKeyOf(site) },
      );
    });
    return toSiteDraftResponse(unpublished);
  }
}
