import type {
  WebsiteTemplateListQuery,
  WebsiteTemplateRevisionListQuery,
} from "@banijjik/contracts/website";
import type { UserId } from "@banijjik/ids";
import type {
  WebsiteTemplate,
  WebsiteTemplateRevision,
} from "../../domain/website-template.entity.js";

export interface WebsiteTemplatePage {
  readonly items: readonly WebsiteTemplate[];
  readonly hasNext: boolean;
}

export interface WebsiteTemplateRevisionPage {
  readonly items: readonly WebsiteTemplateRevision[];
  readonly hasNext: boolean;
}

export interface WebsiteTemplateRepository {
  insert(template: WebsiteTemplate, actorUserId?: UserId): Promise<void>;
  update(
    template: WebsiteTemplate,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<WebsiteTemplate>;
  insertRevision(revision: WebsiteTemplateRevision): Promise<void>;
  findById(websiteTemplateId: string): Promise<WebsiteTemplate | undefined>;
  findByKey(templateKey: string): Promise<WebsiteTemplate | undefined>;
  findMaxRevision(websiteTemplateId: string): Promise<number>;
  list(query: WebsiteTemplateListQuery): Promise<WebsiteTemplatePage>;
  listRevisions(query: WebsiteTemplateRevisionListQuery): Promise<WebsiteTemplateRevisionPage>;
}
