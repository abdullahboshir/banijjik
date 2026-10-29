import { ERROR_CODE } from "@banijjik/contracts";
import type { SaveSiteDraftRequest, SiteDraftResponse } from "@banijjik/contracts/website";
import type { UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { DomainRuleError, versionConflict } from "../../domain/errors.js";
import type { Site } from "../../domain/site.entity.js";
import { sitePolicyEvaluator } from "../../domain/site-policy.js";
import type { SiteRepository } from "../ports/site-repository.js";

export interface SaveSiteDraftInput {
  readonly actorUserId: UserId;
  readonly body: SaveSiteDraftRequest;
  readonly effectiveSectionKeys: readonly string[];
}

export interface SaveSiteDependencies {
  readonly sites: SiteRepository;
  readonly clock: Clock;
}

function toDraftResponse(site: Site): SiteDraftResponse {
  return {
    siteId: site.siteId,
    version: site.version,
    publishedWebsiteVersionId: site.publishedWebsiteVersionId,
    design: site.draftDesign,
    policy: site.editPolicy,
  };
}

/** Tenant save of the full draft document. Policy is the stored copy, never the request body. */
export class SaveSiteDraftUseCase {
  constructor(private readonly dependencies: SaveSiteDependencies) {}

  async execute(input: SaveSiteDraftInput): Promise<SiteDraftResponse> {
    const existing = await this.dependencies.sites.findCurrent();
    if (existing === undefined) {
      throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    }
    if (existing.version !== input.body.expectedVersion) throw versionConflict();
    sitePolicyEvaluator.assertAllowed({
      previous: existing.draftDesign,
      next: input.body.design,
      policy: existing.editPolicy,
      effectiveSectionKeys: input.effectiveSectionKeys,
    });
    const saved = existing.replaceDraft({
      draftDesign: input.body.design,
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
    });
    await this.dependencies.sites.save(saved, input.body.expectedVersion);
    return toDraftResponse(saved);
  }
}
