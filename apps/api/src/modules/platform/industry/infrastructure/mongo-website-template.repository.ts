import type {
  WebsiteTemplateListQuery,
  WebsiteTemplateRevisionListQuery,
} from "@banijjik/contracts/website";
import type { UserId } from "@banijjik/ids";
import { conflict } from "../../../../kernel/http/app-error.js";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  WebsiteTemplatePage,
  WebsiteTemplateRepository,
  WebsiteTemplateRevisionPage,
} from "../application/ports/website-template-repository.js";
import type {
  WebsiteTemplate,
  WebsiteTemplateRevision,
} from "../domain/website-template.entity.js";
import {
  toWebsiteTemplate,
  toWebsiteTemplateDocument,
  toWebsiteTemplateRevision,
  toWebsiteTemplateRevisionDocument,
} from "./website-template.mapper.js";
import {
  isDuplicateWebsiteTemplateRevision,
  toDuplicateWebsiteTemplateKeyError,
} from "./duplicate-website-template-key.js";
import {
  WEBSITE_TEMPLATE_MODEL_NAME,
  WEBSITE_TEMPLATE_REVISION_MODEL_NAME,
  type WebsiteTemplateDocument,
  type WebsiteTemplateRevisionDocument,
} from "./website-template.schema.js";

const WEBSITE_TEMPLATE_PROJECTION = {
  websiteTemplateId: 1,
  templateKey: 1,
  status: 1,
  content: 1,
  currentWebsiteTemplateRevisionId: 1,
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  _id: 0,
} as const;

const WEBSITE_TEMPLATE_REVISION_PROJECTION = {
  websiteTemplateRevisionId: 1,
  websiteTemplateId: 1,
  templateKey: 1,
  revision: 1,
  snapshot: 1,
  publishedAt: 1,
  publishedByUserId: 1,
  _id: 0,
} as const;

export class MongoWebsiteTemplateRepository implements WebsiteTemplateRepository {
  async insert(template: WebsiteTemplate, actorUserId?: UserId): Promise<void> {
    try {
      await this.templateModel().create(
        [toWebsiteTemplateDocument(template, actorUserId)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      throw toDuplicateWebsiteTemplateKeyError(error);
    }
  }

  async update(
    template: WebsiteTemplate,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<WebsiteTemplate> {
    try {
      const saved = await updateVersioned<WebsiteTemplateDocument>({
        model: this.templateModel(),
        filter: { websiteTemplateId: template.websiteTemplateId },
        expectedVersion,
        update: {
          $set: {
            status: template.status,
            content: template.content,
            currentWebsiteTemplateRevisionId: template.currentWebsiteTemplateRevisionId,
            updatedByUserId: actorUserId,
          },
        },
      });
      return toWebsiteTemplate(saved);
    } catch (error) {
      throw toDuplicateWebsiteTemplateKeyError(error);
    }
  }

  async insertRevision(revision: WebsiteTemplateRevision): Promise<void> {
    try {
      await this.revisionModel().create(
        [toWebsiteTemplateRevisionDocument(revision)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      if (isDuplicateWebsiteTemplateRevision(error)) throw conflict({});
      throw error;
    }
  }

  async findById(websiteTemplateId: string): Promise<WebsiteTemplate | undefined> {
    const row = await this.templateModel()
      .findOne(
        { websiteTemplateId },
        WEBSITE_TEMPLATE_PROJECTION,
        sessionOption(getActiveSession()),
      )
      .lean<WebsiteTemplateDocument>();
    return row === null ? undefined : toWebsiteTemplate(row);
  }

  async findByKey(templateKey: string): Promise<WebsiteTemplate | undefined> {
    const row = await this.templateModel()
      .findOne({ templateKey }, WEBSITE_TEMPLATE_PROJECTION, sessionOption(getActiveSession()))
      .lean<WebsiteTemplateDocument>();
    return row === null ? undefined : toWebsiteTemplate(row);
  }

  async findMaxRevision(websiteTemplateId: string): Promise<number> {
    const row = await this.revisionModel()
      .findOne({ websiteTemplateId }, { revision: 1, _id: 0 }, sessionOption(getActiveSession()))
      .sort({ revision: -1 })
      .lean<Pick<WebsiteTemplateRevisionDocument, "revision">>();
    return row?.revision ?? 0;
  }

  async list(query: WebsiteTemplateListQuery): Promise<WebsiteTemplatePage> {
    const filter = query.status === undefined ? {} : { status: query.status };
    const rows = await this.templateModel()
      .find(filter, WEBSITE_TEMPLATE_PROJECTION)
      .sort({ templateKey: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<WebsiteTemplateDocument[]>();
    return {
      items: rows.slice(0, query.limit).map(toWebsiteTemplate),
      hasNext: rows.length > query.limit,
    };
  }

  async listRevisions(
    query: WebsiteTemplateRevisionListQuery,
  ): Promise<WebsiteTemplateRevisionPage> {
    const rows = await this.revisionModel()
      .find(
        { websiteTemplateId: query.websiteTemplateId },
        WEBSITE_TEMPLATE_REVISION_PROJECTION,
        sessionOption(getActiveSession()),
      )
      .sort({ revision: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<WebsiteTemplateRevisionDocument[]>();
    return {
      items: rows.slice(0, query.limit).map(toWebsiteTemplateRevision),
      hasNext: rows.length > query.limit,
    };
  }

  private templateModel() {
    return models({}).get<WebsiteTemplateDocument>(WEBSITE_TEMPLATE_MODEL_NAME);
  }

  private revisionModel() {
    return models({}).get<WebsiteTemplateRevisionDocument>(WEBSITE_TEMPLATE_REVISION_MODEL_NAME);
  }
}
