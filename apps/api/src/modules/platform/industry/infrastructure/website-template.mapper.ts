import { WEBSITE_TEMPLATE_KEY_PATTERN } from "@banijjik/contracts/website";
import {
  asId,
  type UserId,
  type WebsiteTemplateId,
  type WebsiteTemplateRevisionId,
} from "@banijjik/ids";
import { websiteTemplateContentSchema } from "@banijjik/validation/website";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import {
  WebsiteTemplate,
  type WebsiteTemplateRevision,
} from "../domain/website-template.entity.js";
import { invalidWebsiteTemplateField } from "../domain/errors.js";
import type {
  WebsiteTemplateDocument,
  WebsiteTemplateRevisionDocument,
} from "./website-template.schema.js";

export function toWebsiteTemplateDocument(
  template: WebsiteTemplate,
  actorUserId?: UserId,
): WebsiteTemplateDocument {
  websiteTemplateContentSchema.parse(template.content);
  return {
    websiteTemplateId: template.websiteTemplateId,
    templateKey: template.templateKey,
    status: template.status,
    content: template.content,
    currentWebsiteTemplateRevisionId: template.currentWebsiteTemplateRevisionId,
    version: template.version,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    createdByUserId: actorUserId ?? null,
    updatedByUserId: actorUserId ?? null,
  };
}

export function toWebsiteTemplate(document: WebsiteTemplateDocument): WebsiteTemplate {
  const stored = stripMongoInternals(document);
  if (!WEBSITE_TEMPLATE_KEY_PATTERN.test(stored.templateKey)) {
    throw invalidWebsiteTemplateField("templateKey");
  }
  websiteTemplateContentSchema.parse(stored.content);
  return WebsiteTemplate.restore({
    websiteTemplateId: asId<WebsiteTemplateId>(stored.websiteTemplateId),
    templateKey: stored.templateKey,
    status: stored.status,
    content: stored.content,
    currentWebsiteTemplateRevisionId:
      stored.currentWebsiteTemplateRevisionId === null
        ? null
        : asId<WebsiteTemplateRevisionId>(stored.currentWebsiteTemplateRevisionId),
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}

export function toWebsiteTemplateRevisionDocument(
  revision: WebsiteTemplateRevision,
): WebsiteTemplateRevisionDocument {
  websiteTemplateContentSchema.parse(revision.snapshot);
  return {
    websiteTemplateRevisionId: revision.websiteTemplateRevisionId,
    websiteTemplateId: revision.websiteTemplateId,
    templateKey: revision.templateKey,
    revision: revision.revision,
    snapshot: revision.snapshot,
    publishedAt: revision.publishedAt,
    publishedByUserId: revision.publishedByUserId,
    createdAt: revision.publishedAt,
    updatedAt: revision.publishedAt,
    createdByUserId: revision.publishedByUserId,
    updatedByUserId: revision.publishedByUserId,
  };
}

export function toWebsiteTemplateRevision(
  document: WebsiteTemplateRevisionDocument,
): WebsiteTemplateRevision {
  const stored = stripMongoInternals(document);
  websiteTemplateContentSchema.parse(stored.snapshot);
  return {
    websiteTemplateRevisionId: asId<WebsiteTemplateRevisionId>(stored.websiteTemplateRevisionId),
    websiteTemplateId: asId<WebsiteTemplateId>(stored.websiteTemplateId),
    templateKey: stored.templateKey,
    revision: stored.revision,
    snapshot: stored.snapshot,
    publishedAt: stored.publishedAt,
    publishedByUserId: asId<UserId>(stored.publishedByUserId),
  };
}
