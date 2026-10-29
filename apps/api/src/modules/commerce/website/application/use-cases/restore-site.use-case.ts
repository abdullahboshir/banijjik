import { AUDIT_ACTION, ERROR_CODE } from "@banijjik/contracts";
import {
  type PublishedSiteDesign,
  type RestoreSiteRequest,
  type SiteDesign,
  type SiteDraftResponse,
  type StaticPageDraft,
} from "@banijjik/contracts/website";
import { asId, type UserId, type WebsiteVersionId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { DomainRuleError } from "../../domain/errors.js";
import { sitePolicyEvaluator } from "../../domain/site-policy.js";
import { toSiteDraftResponse } from "../site-views.js";
import type {
  SiteMediaChecker,
  SitePublicationUnitOfWork,
  SiteSectionAvailability,
  SiteVersionRepository,
} from "../ports/site-publication-ports.js";
import type { SiteRepository } from "../ports/site-repository.js";
import { assertPublicationImages, currentSiteOf } from "./publish-site.use-case.js";

export interface RestoreSiteDependencies {
  readonly sites: SiteRepository;
  readonly versions: SiteVersionRepository;
  readonly images: SiteMediaChecker;
  readonly sections: SiteSectionAvailability;
  readonly unitOfWork: SitePublicationUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface RestoreSiteInput {
  readonly actorUserId: UserId;
  readonly body: RestoreSiteRequest;
}

/**
 * A snapshot holds the public projection, so it has no draft-only flag. Everything it published comes
 * back opted in; a page it never published keeps the draft copy the tenant still has (decision 12).
 */
function restoredStaticContent(
  snapshot: PublishedSiteDesign,
  current: SiteDesign,
): readonly StaticPageDraft[] {
  const restoredKeys = new Set(snapshot.staticContent.map((page) => page.pageKey));
  return [
    ...snapshot.staticContent.map((page) => ({ ...page, includeInPublication: true })),
    ...current.staticContent.filter((page) => !restoredKeys.has(page.pageKey)),
  ];
}

function restoredDesignOf(snapshot: PublishedSiteDesign, current: SiteDesign): SiteDesign {
  return {
    schemaVersion: snapshot.schemaVersion,
    tokens: snapshot.tokens,
    header: snapshot.header,
    footer: snapshot.footer,
    pages: snapshot.pages,
    staticContent: restoredStaticContent(snapshot, current),
  };
}

/**
 * Restore copies one historical snapshot into a new draft (decision 13). The draft is then validated
 * against the *current* policy, the current modules and the current file visibility: history never
 * rewinds a lock, and publishing the restored draft mints a new revision instead of mutating one.
 */
export class RestoreSiteUseCase {
  constructor(private readonly dependencies: RestoreSiteDependencies) {}

  async execute(input: RestoreSiteInput): Promise<SiteDraftResponse> {
    const site = await currentSiteOf(this.dependencies.sites, input.body.expectedVersion);
    const version = await this.dependencies.versions.findById(
      asId<WebsiteVersionId>(input.body.websiteVersionId),
    );
    if (version === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    const restored = restoredDesignOf(version.design, site.draftDesign);
    const effectiveSectionKeys = await this.dependencies.sections.effectiveSectionKeys();
    sitePolicyEvaluator.assertAllowed({
      previous: site.draftDesign,
      next: restored,
      policy: site.editPolicy,
      effectiveSectionKeys,
    });
    await assertPublicationImages(this.dependencies.images, restored);
    const saved = site.replaceDraft({
      draftDesign: restored,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.sites.save(saved, input.body.expectedVersion);
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.SITE_RESTORED,
        entityType: "site",
        entityId: site.siteId,
        changes: {
          websiteVersionId: { to: version.websiteVersionId },
          revision: { to: version.revision },
        },
      });
    });
    return toSiteDraftResponse(saved);
  }
}
