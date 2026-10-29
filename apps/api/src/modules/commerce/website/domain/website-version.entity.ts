import { SITE_DESIGN_BOUNDS, type PublishedSiteDesign } from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type OrganizationId,
  type SiteId,
  type UserId,
  type WebsiteVersionId,
} from "@banijjik/ids";

export interface WebsiteVersionProps {
  readonly websiteVersionId: WebsiteVersionId;
  readonly organizationId: OrganizationId;
  readonly siteId: SiteId;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly design: PublishedSiteDesign;
  readonly sourceTemplateKey: string;
  readonly sourceTemplateRevision: number;
  readonly publishedByUserId: UserId | null;
  readonly publishedByPlatformOperatorId: string | null;
  readonly publishedAt: Date;
}

export interface CreateWebsiteVersionInput {
  readonly organizationId: OrganizationId;
  readonly siteId: SiteId;
  readonly revision: number;
  readonly design: PublishedSiteDesign;
  readonly sourceTemplateKey: string;
  readonly sourceTemplateRevision: number;
  readonly publishedByUserId: UserId | null;
  readonly now: Date;
}

/**
 * One immutable published snapshot (card 4.1 decision 2). It stores the public projection, never the
 * draft, so a reader cannot reach a flag or a section the current modules do not allow.
 */
export class WebsiteVersion {
  private constructor(private readonly props: WebsiteVersionProps) {}

  static create(input: CreateWebsiteVersionInput): WebsiteVersion {
    return new WebsiteVersion({
      websiteVersionId: asId<WebsiteVersionId>(newId()),
      organizationId: input.organizationId,
      siteId: input.siteId,
      revision: input.revision,
      schemaVersion: SITE_DESIGN_BOUNDS.schemaVersion,
      design: input.design,
      sourceTemplateKey: input.sourceTemplateKey,
      sourceTemplateRevision: input.sourceTemplateRevision,
      publishedByUserId: input.publishedByUserId,
      publishedByPlatformOperatorId: null,
      publishedAt: input.now,
    });
  }

  static rehydrate(props: WebsiteVersionProps): WebsiteVersion {
    return new WebsiteVersion(props);
  }

  get websiteVersionId(): WebsiteVersionId {
    return this.props.websiteVersionId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get siteId(): SiteId {
    return this.props.siteId;
  }

  get revision(): number {
    return this.props.revision;
  }

  get schemaVersion(): number {
    return this.props.schemaVersion;
  }

  get design(): PublishedSiteDesign {
    return this.props.design;
  }

  get sourceTemplateKey(): string {
    return this.props.sourceTemplateKey;
  }

  get sourceTemplateRevision(): number {
    return this.props.sourceTemplateRevision;
  }

  get publishedByUserId(): UserId | null {
    return this.props.publishedByUserId;
  }

  get publishedAt(): Date {
    return this.props.publishedAt;
  }
}
