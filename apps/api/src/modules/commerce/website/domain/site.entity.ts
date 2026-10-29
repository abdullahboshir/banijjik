import type { SiteDesign, SiteEditPolicy } from "@banijjik/contracts/website";
import {
  asId,
  newId,
  type OrganizationId,
  type SiteId,
  type UserId,
  type WebsiteVersionId,
} from "@banijjik/ids";

export interface SiteProps {
  readonly siteId: SiteId;
  readonly organizationId: OrganizationId;
  readonly draftDesign: SiteDesign;
  readonly editPolicy: SiteEditPolicy;
  readonly sourceTemplateKey: string;
  readonly sourceTemplateRevision: number;
  readonly publishedWebsiteVersionId: WebsiteVersionId | null;
  readonly nextRevision: number;
  readonly hasPublishedOnce: boolean;
  readonly canonicalSiteDomainId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export interface CreateSiteInput {
  readonly organizationId: OrganizationId;
  readonly draftDesign: SiteDesign;
  readonly editPolicy: SiteEditPolicy;
  readonly sourceTemplateKey: string;
  readonly sourceTemplateRevision: number;
  readonly now: Date;
  readonly actorUserId: UserId | null;
}

/**
 * One organization-owned site (card 4.1). Draft lives here; published snapshots are WebsiteVersion
 * rows. Version is a CAS token: a stale editor is refused, never overwritten.
 */
export class Site {
  private constructor(private readonly props: SiteProps) {}

  static create(input: CreateSiteInput): Site {
    return new Site({
      siteId: asId<SiteId>(newId()),
      organizationId: input.organizationId,
      draftDesign: input.draftDesign,
      editPolicy: input.editPolicy,
      sourceTemplateKey: input.sourceTemplateKey,
      sourceTemplateRevision: input.sourceTemplateRevision,
      publishedWebsiteVersionId: null,
      nextRevision: 1,
      hasPublishedOnce: false,
      canonicalSiteDomainId: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: SiteProps): Site {
    return new Site(props);
  }

  get siteId(): SiteId {
    return this.props.siteId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get draftDesign(): SiteDesign {
    return this.props.draftDesign;
  }

  get editPolicy(): SiteEditPolicy {
    return this.props.editPolicy;
  }

  get sourceTemplateKey(): string {
    return this.props.sourceTemplateKey;
  }

  get sourceTemplateRevision(): number {
    return this.props.sourceTemplateRevision;
  }

  get publishedWebsiteVersionId(): WebsiteVersionId | null {
    return this.props.publishedWebsiteVersionId;
  }

  get nextRevision(): number {
    return this.props.nextRevision;
  }

  get hasPublishedOnce(): boolean {
    return this.props.hasPublishedOnce;
  }

  get canonicalSiteDomainId(): string | null {
    return this.props.canonicalSiteDomainId;
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

  /** Tenant save: policy, provenance and publication pointer stay as stored. */
  replaceDraft(input: {
    readonly draftDesign: SiteDesign;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Site {
    return new Site({
      ...this.props,
      draftDesign: input.draftDesign,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  /**
   * A publish consumes one revision and moves the public pointer in the same CAS step. `hasPublishedOnce`
   * is one-way: after the first site publish the legacy static-page fallback never returns (4.1 audit).
   */
  markPublished(input: {
    readonly websiteVersionId: WebsiteVersionId;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Site {
    return new Site({
      ...this.props,
      publishedWebsiteVersionId: input.websiteVersionId,
      hasPublishedOnce: true,
      nextRevision: this.props.nextRevision + 1,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  /** Unpublish clears the pointer only. History, the next revision and the one-way flag stay. */
  markUnpublished(input: { readonly now: Date; readonly actorUserId: UserId | null }): Site {
    return new Site({
      ...this.props,
      publishedWebsiteVersionId: null,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  /** Canonical host is a pointer on Site, never a flag on SiteDomain (plan 4.2 Refresh A2-1). */
  setCanonical(input: {
    readonly siteDomainId: string;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Site {
    return new Site({
      ...this.props,
      canonicalSiteDomainId: input.siteDomainId,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }

  clearCanonical(input: { readonly now: Date; readonly actorUserId: UserId | null }): Site {
    return new Site({
      ...this.props,
      canonicalSiteDomainId: null,
      version: this.props.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }
}
