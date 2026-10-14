import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateKey } from "@banijjik/contracts";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
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
  async insert(template: IndustryTemplate): Promise<void> {
    await this.model().create(
      [toIndustryTemplateDocument(template)],
      sessionOption(getActiveSession()),
    );
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
