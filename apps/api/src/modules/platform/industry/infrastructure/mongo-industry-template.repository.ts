import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateKey } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { toDuplicateIndustryTemplateKeyError } from "./duplicate-industry-template-key.js";
import type {
  IndustryTemplateListQuery,
  IndustryTemplatePage,
  IndustryTemplateRepository,
} from "../application/ports/industry-template-repository.js";
import type { IndustryTemplate } from "../domain/industry-template.entity.js";
import { toIndustryTemplate, toIndustryTemplateDocument } from "./industry-template.mapper.js";
import {
  INDUSTRY_TEMPLATE_MODEL_NAME,
  type IndustryTemplateDocument,
} from "./industry-template.schema.js";

/** Industry templates are platform configuration, shared by every organization (tenancy NONE). */
export class MongoIndustryTemplateRepository implements IndustryTemplateRepository {
  async insert(template: IndustryTemplate, actorUserId?: UserId): Promise<void> {
    const document = toIndustryTemplateDocument(template);
    try {
      await this.model().create(
        [
          {
            ...document,
            createdByUserId: actorUserId ?? null,
            updatedByUserId: actorUserId ?? null,
          },
        ],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      throw toDuplicateIndustryTemplateKeyError(error);
    }
  }

  async update(
    template: IndustryTemplate,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<IndustryTemplate> {
    const saved = await updateVersioned<IndustryTemplateDocument>({
      model: this.model(),
      filter: { industryTemplateId: template.industryTemplateId },
      expectedVersion,
      update: {
        $set: {
          name: template.name,
          description: template.description,
          iconKey: template.iconKey,
          enabledKinds: [...template.enabledKinds],
          allowedModuleKeys: [...template.allowedModuleKeys],
          configuration: template.configuration,
          status: template.status,
          updatedByUserId: actorUserId,
        },
      },
    });
    return toIndustryTemplate(saved);
  }

  async reservePublished(templateKey: IndustryTemplateKey): Promise<boolean> {
    // referenceVersion is the guard counter: it must not bump version or updatedAt.
    const updated = await this.model().findOneAndUpdate(
      { industryTemplateKey: templateKey, status: INDUSTRY_TEMPLATE_STATUS.PUBLISHED },
      { $inc: { referenceVersion: 1 } },
      { returnDocument: "after", timestamps: false, ...sessionOption(getActiveSession()) },
    );
    return updated !== null;
  }

  async findExistingKeys(templateKeys: readonly string[]): Promise<ReadonlySet<string>> {
    const rows = await this.model()
      .find(
        // The brand is type-only. These strings are template keys already checked by the schema.
        { industryTemplateKey: { $in: templateKeys as readonly IndustryTemplateKey[] } },
        { industryTemplateKey: 1, _id: 0 },
      )
      .lean<Pick<IndustryTemplateDocument, "industryTemplateKey">[]>();
    return new Set(rows.map((row) => row.industryTemplateKey));
  }

  async findByKey(templateKey: IndustryTemplateKey): Promise<IndustryTemplate | undefined> {
    const row = await this.model()
      .findOne({ industryTemplateKey: templateKey }, null, sessionOption(getActiveSession()))
      .lean<IndustryTemplateDocument>();
    return row === null ? undefined : toIndustryTemplate(row);
  }

  async findById(industryTemplateId: string): Promise<IndustryTemplate | undefined> {
    const row = await this.model()
      .findOne({ industryTemplateId }, null, sessionOption(getActiveSession()))
      .lean<IndustryTemplateDocument>();
    return row === null ? undefined : toIndustryTemplate(row);
  }

  async listPublished(limit: number): Promise<readonly IndustryTemplate[]> {
    const rows = await this.model()
      .find({ status: INDUSTRY_TEMPLATE_STATUS.PUBLISHED })
      .sort({ industryTemplateKey: 1 })
      .limit(limit)
      .lean<IndustryTemplateDocument[]>();
    return rows.map(toIndustryTemplate);
  }

  async list(query: IndustryTemplateListQuery): Promise<IndustryTemplatePage> {
    const filter = query.status === undefined ? {} : { status: query.status };
    const rows = await this.model()
      .find(filter)
      .sort({ industryTemplateKey: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<IndustryTemplateDocument[]>();
    return {
      items: rows.slice(0, query.limit).map(toIndustryTemplate),
      hasNext: rows.length > query.limit,
    };
  }

  private model() {
    return models({}).get<IndustryTemplateDocument>(INDUSTRY_TEMPLATE_MODEL_NAME);
  }
}
