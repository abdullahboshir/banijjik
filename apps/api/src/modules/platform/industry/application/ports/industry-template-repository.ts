import type { IndustryTemplateKey, IndustryTemplateStatus } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
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
  insert(template: IndustryTemplate, actorUserId?: UserId): Promise<void>;
  /** Saves the template when `version` is still `expectedVersion`, otherwise 409. */
  update(
    template: IndustryTemplate,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<IndustryTemplate>;
  /**
   * Increments `referenceVersion` when the template is PUBLISHED, inside the active session.
   * False when no published row matched, so a concurrent retire wins (ADR-101).
   */
  reservePublished(templateKey: IndustryTemplateKey): Promise<boolean>;
  /**
   * Increments `referenceVersion` when the template is DRAFT or PUBLISHED, inside the active
   * session. Undefined when no assignable row matched (ADR-092, review R1-1).
   */
  reserveAssignable(templateKey: IndustryTemplateKey): Promise<IndustryTemplate | undefined>;
  findExistingKeys(templateKeys: readonly string[]): Promise<ReadonlySet<string>>;
  findByKey(templateKey: IndustryTemplateKey): Promise<IndustryTemplate | undefined>;
  findById(industryTemplateId: string): Promise<IndustryTemplate | undefined>;
  /** Published templates, ordered by key, at most `limit` rows. */
  listPublished(limit: number): Promise<readonly IndustryTemplate[]>;
  list(query: IndustryTemplateListQuery): Promise<IndustryTemplatePage>;
}
