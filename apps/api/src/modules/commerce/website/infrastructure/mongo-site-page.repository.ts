import type { SitePageKey } from "@banijjik/contracts/website";
import { asId, type OrganizationId, type SitePageId, type UserId } from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { SitePageRepository } from "../application/ports/site-page-repository.js";
import { SitePage } from "../domain/site-page.entity.js";
import { SITE_PAGE_MODEL_NAME, type SitePageDocument } from "./site-page.schema.js";

function pageModel(): Model<SitePageDocument> {
  return models({}).get<SitePageDocument>(SITE_PAGE_MODEL_NAME);
}

function toSitePage(row: SitePageDocument): SitePage {
  return SitePage.rehydrate({
    sitePageId: asId<SitePageId>(row.sitePageId),
    organizationId: asId<OrganizationId>(row.organizationId),
    pageKey: row.pageKey,
    title: row.title,
    body: row.body,
    isPublished: row.isPublished,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId === null ? null : asId<UserId>(row.createdByUserId),
    updatedByUserId: row.updatedByUserId === null ? null : asId<UserId>(row.updatedByUserId),
  });
}

export class MongoSitePageRepository implements SitePageRepository {
  async findByKey(pageKey: SitePageKey): Promise<SitePage | undefined> {
    const row = await pageModel().findOne({ pageKey }).lean<SitePageDocument>();
    return row === null ? undefined : toSitePage(row);
  }

  async listAll(): Promise<SitePage[]> {
    const rows = await pageModel().find({}).lean<SitePageDocument[]>();
    return rows.map(toSitePage);
  }

  async listPublished(): Promise<SitePage[]> {
    const rows = await pageModel().find({ isPublished: true }).lean<SitePageDocument[]>();
    return rows.map(toSitePage);
  }

  async insert(page: SitePage): Promise<"inserted" | "duplicate"> {
    try {
      await pageModel().create(
        [
          {
            sitePageId: page.sitePageId,
            organizationId: page.organizationId,
            pageKey: page.pageKey,
            title: page.title,
            body: page.body,
            isPublished: page.isPublished,
            version: page.version,
            createdAt: page.createdAt,
            updatedAt: page.updatedAt,
            createdByUserId: page.createdByUserId,
            updatedByUserId: page.updatedByUserId,
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

  async save(page: SitePage, expectedVersion: number): Promise<void> {
    await updateVersioned<SitePageDocument>({
      model: pageModel(),
      filter: { sitePageId: page.sitePageId },
      expectedVersion,
      update: {
        $set: {
          title: page.title,
          body: page.body,
          isPublished: page.isPublished,
          updatedAt: page.updatedAt,
          updatedByUserId: page.updatedByUserId,
        },
      },
    });
  }
}
