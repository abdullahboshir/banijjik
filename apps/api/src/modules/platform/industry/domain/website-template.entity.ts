import {
  WEBSITE_TEMPLATE_KEY_PATTERN,
  WEBSITE_TEMPLATE_STATUS,
  type WebsiteTemplateContent,
  type WebsiteTemplateStatus,
} from "@banijjik/contracts/website";
import {
  newId,
  type UserId,
  type WebsiteTemplateId,
  type WebsiteTemplateRevisionId,
} from "@banijjik/ids";
import {
  invalidWebsiteTemplateField,
  websiteTemplateArchived,
  websiteTemplateImageForbidden,
  websiteTemplateTransitionInvalid,
} from "./errors.js";

const INITIAL_VERSION = 1;

export interface WebsiteTemplateProps {
  readonly websiteTemplateId: WebsiteTemplateId;
  readonly templateKey: string;
  readonly status: WebsiteTemplateStatus;
  readonly content: WebsiteTemplateContent;
  readonly currentWebsiteTemplateRevisionId: WebsiteTemplateRevisionId | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WebsiteTemplateRevision {
  readonly websiteTemplateRevisionId: WebsiteTemplateRevisionId;
  readonly websiteTemplateId: WebsiteTemplateId;
  readonly templateKey: string;
  readonly revision: number;
  readonly snapshot: WebsiteTemplateContent;
  readonly publishedAt: Date;
  readonly publishedByUserId: UserId;
}

export interface WebsiteTemplateRevisionInput {
  readonly websiteTemplateId: WebsiteTemplateId;
  readonly templateKey: string;
  readonly revision: number;
  readonly snapshot: WebsiteTemplateContent;
  readonly publishedAt: Date;
  readonly publishedByUserId: UserId;
}

export function createWebsiteTemplateRevision(
  input: WebsiteTemplateRevisionInput,
): WebsiteTemplateRevision {
  return { ...input, websiteTemplateRevisionId: newId<WebsiteTemplateRevisionId>() };
}

export interface WebsiteTemplatePublishRevision {
  readonly websiteTemplateRevisionId: WebsiteTemplateRevisionId;
  readonly revision: number;
  readonly snapshot: WebsiteTemplateContent;
  readonly publishedAt: Date;
}

export class WebsiteTemplate implements WebsiteTemplateProps {
  readonly websiteTemplateId: WebsiteTemplateId;
  readonly templateKey: string;
  readonly status: WebsiteTemplateStatus;
  readonly content: WebsiteTemplateContent;
  readonly currentWebsiteTemplateRevisionId: WebsiteTemplateRevisionId | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: WebsiteTemplateProps) {
    this.websiteTemplateId = props.websiteTemplateId;
    this.templateKey = props.templateKey;
    this.status = props.status;
    this.content = props.content;
    this.currentWebsiteTemplateRevisionId = props.currentWebsiteTemplateRevisionId;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: {
    readonly templateKey: string;
    readonly content: WebsiteTemplateContent;
    readonly now: Date;
  }): WebsiteTemplate {
    assertTemplateKey(input.templateKey);
    assertContent(input.content);
    return new WebsiteTemplate({
      websiteTemplateId: newId<WebsiteTemplateId>(),
      templateKey: input.templateKey,
      status: WEBSITE_TEMPLATE_STATUS.DRAFT,
      content: input.content,
      currentWebsiteTemplateRevisionId: null,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: WebsiteTemplateProps): WebsiteTemplate {
    return new WebsiteTemplate(props);
  }

  withEdits(content: WebsiteTemplateContent, now: Date): WebsiteTemplate {
    if (this.status === WEBSITE_TEMPLATE_STATUS.ARCHIVED) throw websiteTemplateArchived();
    assertContent(content);
    return new WebsiteTemplate({ ...this, content, updatedAt: now });
  }

  published(revision: WebsiteTemplatePublishRevision, now: Date): WebsiteTemplate {
    if (this.status === WEBSITE_TEMPLATE_STATUS.ARCHIVED) {
      throw websiteTemplateTransitionInvalid({
        fromStatus: this.status,
        toStatus: WEBSITE_TEMPLATE_STATUS.PUBLISHED,
      });
    }
    return new WebsiteTemplate({
      ...this,
      status: WEBSITE_TEMPLATE_STATUS.PUBLISHED,
      currentWebsiteTemplateRevisionId: revision.websiteTemplateRevisionId,
      updatedAt: now,
    });
  }

  archived(now: Date): WebsiteTemplate {
    if (this.status === WEBSITE_TEMPLATE_STATUS.ARCHIVED) {
      throw websiteTemplateTransitionInvalid({
        fromStatus: this.status,
        toStatus: WEBSITE_TEMPLATE_STATUS.ARCHIVED,
      });
    }
    return new WebsiteTemplate({
      ...this,
      status: WEBSITE_TEMPLATE_STATUS.ARCHIVED,
      updatedAt: now,
    });
  }
}

function assertTemplateKey(templateKey: string): void {
  if (!WEBSITE_TEMPLATE_KEY_PATTERN.test(templateKey)) {
    throw invalidWebsiteTemplateField("templateKey");
  }
}

function assertContent(content: WebsiteTemplateContent): void {
  if (!content.presets.some((preset) => preset.presetKey === content.defaultPresetKey)) {
    throw invalidWebsiteTemplateField("defaultPresetKey");
  }
  const sections = [
    content.design.header,
    content.design.footer,
    ...content.design.pages.flatMap((page) => page.sections),
  ];
  for (const section of sections) {
    if (containsImageFileId(section.content))
      throw websiteTemplateImageForbidden(section.sectionId);
  }
}

function containsImageFileId(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsImageFileId);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    key === "imageFileId"
      ? typeof child === "string" && child.length > 0
      : containsImageFileId(child),
  );
}
