import type { LocalizedText, SitePageKey } from "@banijjik/contracts/website";
import { asId, newId, type OrganizationId, type SitePageId, type UserId } from "@banijjik/ids";

export interface SitePageProps {
  readonly sitePageId: SitePageId;
  readonly organizationId: OrganizationId;
  readonly pageKey: SitePageKey;
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface SitePageContent {
  readonly title: LocalizedText;
  readonly body: LocalizedText;
  readonly isPublished: boolean;
}

/**
 * One static page of a business (ADR-144). One row per organization and page key. Every save bumps
 * `version`, so a stale editor is refused by the repository (409), not silently overwritten.
 */
export class SitePage {
  private constructor(private readonly props: SitePageProps) {}

  /** The first save of a page key: version 1. */
  static create(input: {
    readonly organizationId: OrganizationId;
    readonly pageKey: SitePageKey;
    readonly content: SitePageContent;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): SitePage {
    return new SitePage({
      sitePageId: asId<SitePageId>(newId()),
      organizationId: input.organizationId,
      pageKey: input.pageKey,
      title: input.content.title,
      body: input.content.body,
      isPublished: input.content.isPublished,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: SitePageProps): SitePage {
    return new SitePage(props);
  }

  get sitePageId(): SitePageId {
    return this.props.sitePageId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get pageKey(): SitePageKey {
    return this.props.pageKey;
  }

  get title(): LocalizedText {
    return this.props.title;
  }

  get body(): LocalizedText {
    return this.props.body;
  }

  get isPublished(): boolean {
    return this.props.isPublished;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  /** A new version of the page with the saved content. The caller checks the expected version. */
  replaceContent(input: {
    readonly content: SitePageContent;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): SitePage {
    return new SitePage({
      ...this.props,
      title: input.content.title,
      body: input.content.body,
      isPublished: input.content.isPublished,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }
}
