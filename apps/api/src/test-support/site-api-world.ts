import type { SiteDesign, SiteEditPolicy } from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { MongoSiteRepository } from "../modules/commerce/website/infrastructure/mongo-site.repository.js";
import { Site } from "../modules/commerce/website/domain/site.entity.js";
import { withOrganizationContext } from "./organization-context.js";

export interface AdoptSiteInput {
  readonly draftDesign: SiteDesign;
  readonly editPolicy: SiteEditPolicy;
  /** The member whose id the audit trail of the adoption names. */
  readonly actorUserId?: string;
}

/**
 * Writing a site into a business (adoption) is card 4.4, so a card-4.1 API test that needs a document
 * stores one through the real repository, in the business's own tenant context. It starts unpublished,
 * exactly as an adopted site does.
 */
export async function adoptSite(
  organizationId: string,
  input: AdoptSiteInput,
): Promise<{ readonly siteId: string; readonly version: number }> {
  const site = Site.create({
    organizationId: asId<OrganizationId>(organizationId),
    draftDesign: input.draftDesign,
    editPolicy: input.editPolicy,
    sourceTemplateKey: "retail-starter",
    sourceTemplateRevision: 1,
    now: new Date(),
    actorUserId: asId<UserId>(input.actorUserId ?? newId()),
  });
  const outcome = await withOrganizationContext(organizationId, () =>
    new MongoSiteRepository().insert(site),
  );
  if (outcome === "duplicate") throw new Error("this business already has a site");
  return { siteId: site.siteId, version: site.version };
}
