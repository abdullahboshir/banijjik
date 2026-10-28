import type { SiteDesign, SiteEditPolicy } from "@banijjik/contracts/website";
import {
  asId,
  type OrganizationId,
  type SiteId,
  type UserId,
  type WebsiteVersionId,
} from "@banijjik/ids";
import { siteDesignSchema, siteEditPolicySchema } from "@banijjik/validation/website";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { SiteRepository } from "../application/ports/site-repository.js";
import { Site } from "../domain/site.entity.js";
import { SITE_MODEL_NAME, type SiteDocument } from "./site.schema.js";

function siteModel(): Model<SiteDocument> {
  return models({}).get<SiteDocument>(SITE_MODEL_NAME);
}

function publishedVersionId(value: string | null): WebsiteVersionId | null {
  return value === null ? null : asId<WebsiteVersionId>(value);
}

function toSite(row: SiteDocument): Site {
  return Site.rehydrate({
    siteId: asId<SiteId>(row.siteId),
    organizationId: asId<OrganizationId>(row.organizationId),
    // Zod optional fields are `T | undefined`; SiteDesign uses exactOptionalPropertyTypes.
    draftDesign: siteDesignSchema.parse(row.draftDesign) as SiteDesign,
    editPolicy: siteEditPolicySchema.parse(row.editPolicy) as SiteEditPolicy,
    sourceTemplateKey: row.sourceTemplateKey,
    sourceTemplateRevision: row.sourceTemplateRevision,
    publishedWebsiteVersionId: publishedVersionId(row.publishedWebsiteVersionId),
    nextRevision: row.nextRevision,
    hasPublishedOnce: row.hasPublishedOnce,
    canonicalSiteDomainId: row.canonicalSiteDomainId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

function documentOf(site: Site): Omit<SiteDocument, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    siteId: site.siteId,
    organizationId: site.organizationId,
    draftDesign: site.draftDesign,
    editPolicy: site.editPolicy,
    sourceTemplateKey: site.sourceTemplateKey,
    sourceTemplateRevision: site.sourceTemplateRevision,
    publishedWebsiteVersionId: site.publishedWebsiteVersionId,
    nextRevision: site.nextRevision,
    hasPublishedOnce: site.hasPublishedOnce,
    canonicalSiteDomainId: site.canonicalSiteDomainId,
    version: site.version,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    createdByUserId: site.createdByUserId,
    updatedByUserId: site.updatedByUserId,
  };
}

export class MongoSiteRepository implements SiteRepository {
  async findCurrent(): Promise<Site | undefined> {
    const row = await siteModel().findOne({}).lean<SiteDocument>();
    return row === null ? undefined : toSite(row);
  }

  async insert(site: Site): Promise<"inserted" | "duplicate"> {
    try {
      await siteModel().create([documentOf(site)], sessionOption(getActiveSession()));
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error)) return "duplicate";
      throw error;
    }
  }

  async save(site: Site, expectedVersion: number): Promise<void> {
    await updateVersioned<SiteDocument>({
      model: siteModel(),
      filter: { siteId: site.siteId },
      expectedVersion,
      update: {
        $set: {
          draftDesign: site.draftDesign,
          updatedAt: site.updatedAt,
          updatedByUserId: site.updatedByUserId,
        },
      },
    });
  }
}
