import type { PublishedSiteDesign, SiteVersionMetadata } from "@banijjik/contracts/website";
import {
  asId,
  type OrganizationId,
  type SiteId,
  type UserId,
  type WebsiteVersionId,
} from "@banijjik/ids";
import { publishedSiteDesignSchema } from "@banijjik/validation/website";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type { SiteVersionRepository } from "../application/ports/site-publication-ports.js";
import { assertRenderableSchemaVersion } from "../domain/site-projection.js";
import { WebsiteVersion } from "../domain/website-version.entity.js";
import {
  WEBSITE_VERSION_MODEL_NAME,
  type WebsiteVersionDocument,
} from "./website-version.schema.js";

function versionModel(): Model<WebsiteVersionDocument> {
  return models({}).get<WebsiteVersionDocument>(WEBSITE_VERSION_MODEL_NAME);
}

/** A stored snapshot is decoded, never trusted: an unknown schema version fails closed (P4-12). */
function toVersion(row: WebsiteVersionDocument): WebsiteVersion {
  assertRenderableSchemaVersion(row.schemaVersion);
  return WebsiteVersion.rehydrate({
    websiteVersionId: asId<WebsiteVersionId>(row.websiteVersionId),
    organizationId: asId<OrganizationId>(row.organizationId),
    siteId: asId<SiteId>(row.siteId),
    revision: row.revision,
    schemaVersion: row.schemaVersion,
    // Zod optional fields are `T | undefined`; PublishedSiteDesign uses exactOptionalPropertyTypes.
    design: publishedSiteDesignSchema.parse(row.design) as PublishedSiteDesign,
    sourceTemplateKey: row.sourceTemplateKey,
    sourceTemplateRevision: row.sourceTemplateRevision,
    publishedByUserId: row.publishedByUserId === null ? null : asId<UserId>(row.publishedByUserId),
    publishedByPlatformOperatorId: row.publishedByPlatformOperatorId,
    publishedAt: row.publishedAt,
  });
}

function toMetadata(row: WebsiteVersionDocument): SiteVersionMetadata {
  return {
    websiteVersionId: row.websiteVersionId,
    revision: row.revision,
    schemaVersion: row.schemaVersion,
    sourceTemplateKey: row.sourceTemplateKey,
    sourceTemplateRevision: row.sourceTemplateRevision,
    publishedByUserId: row.publishedByUserId,
    publishedAt: row.publishedAt.toISOString(),
  };
}

const METADATA_PROJECTION = {
  websiteVersionId: 1,
  revision: 1,
  schemaVersion: 1,
  sourceTemplateKey: 1,
  sourceTemplateRevision: 1,
  publishedByUserId: 1,
  publishedAt: 1,
};

/** Newest first, so a tie on the timestamp still answers in one stable order. */
const VERSION_SORT = { publishedAt: -1, websiteVersionId: 1 } as const;

export class MongoSiteVersionRepository implements SiteVersionRepository {
  async insert(version: WebsiteVersion): Promise<"inserted" | "duplicate"> {
    try {
      await versionModel().create(
        [
          {
            websiteVersionId: version.websiteVersionId,
            organizationId: version.organizationId,
            siteId: version.siteId,
            revision: version.revision,
            schemaVersion: version.schemaVersion,
            design: version.design,
            sourceTemplateKey: version.sourceTemplateKey,
            sourceTemplateRevision: version.sourceTemplateRevision,
            publishedByUserId: version.publishedByUserId,
            publishedByPlatformOperatorId: null,
            publishedAt: version.publishedAt,
          },
        ],
        sessionOption(getActiveSession()),
      );
      return "inserted";
    } catch (error) {
      if (isDuplicateKeyError(error)) return "duplicate";
      throw error;
    }
  }

  async findById(websiteVersionId: WebsiteVersionId): Promise<WebsiteVersion | undefined> {
    const row = await versionModel()
      .findOne({ websiteVersionId }, undefined, sessionOption(getActiveSession()))
      .lean<WebsiteVersionDocument>();
    return row === null ? undefined : toVersion(row);
  }

  async listMetadata(input: {
    readonly siteId: SiteId;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly SiteVersionMetadata[]; readonly total: number }> {
    const model = versionModel();
    const filter = { siteId: input.siteId };
    const [rows, total] = await Promise.all([
      model
        .find(filter, METADATA_PROJECTION)
        .sort(VERSION_SORT)
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
        .lean<WebsiteVersionDocument[]>(),
      model.countDocuments(filter),
    ]);
    return { items: rows.map(toMetadata), total };
  }
}
