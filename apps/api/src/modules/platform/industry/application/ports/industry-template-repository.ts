import type { IndustryTemplateKey, IndustryTemplateStatus } from "@banijjik/contracts";
import type { IndustryTemplate } from "../../domain/industry-template.entity.js";

export interface IndustryTemplateListQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: IndustryTemplateStatus | undefined;
}

export interface IndustryTemplatePage {
  readonly items: readonly IndustryTemplate[];
  readonly hasNext: boolean;
}

/** Platform data (tenancy NONE). The database is the source of truth after the first seed (ADR-076). */
export interface IndustryTemplateRepository {
  insert(template: IndustryTemplate): Promise<void>;
  findExistingKeys(templateKeys: readonly string[]): Promise<ReadonlySet<string>>;
  findByKey(templateKey: IndustryTemplateKey): Promise<IndustryTemplate | undefined>;
  findById(industryTemplateId: string): Promise<IndustryTemplate | undefined>;
  /** Published templates, ordered by key, at most `limit` rows. */
  listPublished(limit: number): Promise<readonly IndustryTemplate[]>;
  list(query: IndustryTemplateListQuery): Promise<IndustryTemplatePage>;
}
