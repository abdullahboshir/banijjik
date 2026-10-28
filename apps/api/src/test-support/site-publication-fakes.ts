import type {
  PublishedSiteDesign,
  SitePublicationPayload,
  SiteVersionMetadata,
  WebsiteEventType,
} from "@banijjik/contracts/website";
import { asId, newId, type SiteId, type UserId, type WebsiteVersionId } from "@banijjik/ids";
import type {
  SiteMediaChecker,
  SitePublicationEventPublisher,
  SitePublicationUnitOfWork,
  SiteSectionAvailability,
  SiteVersionRepository,
} from "../modules/commerce/website/application/ports/site-publication-ports.js";
import { Site } from "../modules/commerce/website/domain/site.entity.js";
import { WebsiteVersion } from "../modules/commerce/website/domain/website-version.entity.js";
import { InMemoryAuditRecorder } from "./audit-fakes.js";
import { MutableClock } from "./mutable-clock.js";
import { InMemorySiteRepository } from "./site-fixtures.js";

export class InMemorySiteVersionRepository implements SiteVersionRepository {
  readonly rows: WebsiteVersion[] = [];

  async insert(version: WebsiteVersion): Promise<"inserted" | "duplicate"> {
    const clash = this.rows.some(
      (row) => row.siteId === version.siteId && row.revision === version.revision,
    );
    if (clash) return "duplicate";
    this.rows.push(version);
    return "inserted";
  }

  async findById(websiteVersionId: WebsiteVersionId): Promise<WebsiteVersion | undefined> {
    return this.rows.find((row) => row.websiteVersionId === websiteVersionId);
  }

  async listMetadata(input: {
    readonly siteId: SiteId;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly SiteVersionMetadata[]; readonly total: number }> {
    const mine = this.rows
      .filter((row) => row.siteId === input.siteId)
      .sort((left, right) => right.revision - left.revision);
    const start = (input.page - 1) * input.limit;
    return {
      items: mine.slice(start, start + input.limit).map(toMetadata),
      total: mine.length,
    };
  }
}

function toMetadata(version: WebsiteVersion): SiteVersionMetadata {
  return {
    websiteVersionId: version.websiteVersionId,
    revision: version.revision,
    schemaVersion: version.schemaVersion,
    sourceTemplateKey: version.sourceTemplateKey,
    sourceTemplateRevision: version.sourceTemplateRevision,
    publishedByUserId: version.publishedByUserId,
    publishedAt: version.publishedAt.toISOString(),
  };
}

/** A snapshot the tenant published earlier, kept for the restore and read tests. */
export function storedVersion(input: {
  readonly site: Site;
  readonly design: PublishedSiteDesign;
  readonly revision?: number;
  readonly publishedAt?: Date;
}): WebsiteVersion {
  return WebsiteVersion.create({
    organizationId: input.site.organizationId,
    siteId: input.site.siteId,
    revision: input.revision ?? input.site.nextRevision,
    design: input.design,
    sourceTemplateKey: input.site.sourceTemplateKey,
    sourceTemplateRevision: input.site.sourceTemplateRevision,
    publishedByUserId: asId<UserId>(newId()),
    now: input.publishedAt ?? new Date("2026-10-27T00:00:00.000Z"),
  });
}

export class FakeSiteMediaChecker implements SiteMediaChecker {
  /** The last list the use case asked about, so a test can see the document was checked as a whole. */
  asked: readonly string[] = [];

  constructor(private readonly usableFileIds: readonly string[] = []) {}

  async filterUsable(fileIds: readonly string[]): Promise<ReadonlySet<string>> {
    this.asked = fileIds;
    return new Set(fileIds.filter((fileId) => this.usableFileIds.includes(fileId)));
  }
}

export class FakeSiteSectionAvailability implements SiteSectionAvailability {
  constructor(private readonly keys: readonly string[] = []) {}

  async effectiveSectionKeys(): Promise<readonly string[]> {
    return this.keys;
  }
}

/** The transaction seam runs the work inline: a unit test checks the order, not the rollback. */
export class InlineUnitOfWork implements SitePublicationUnitOfWork {
  async run<Result>(work: () => Promise<Result>): Promise<Result> {
    return work();
  }
}

export interface RecordedPublicationEvent {
  readonly type: WebsiteEventType;
  readonly payload: SitePublicationPayload;
  readonly orderingKey: string;
}

export class RecordingSitePublicationPublisher implements SitePublicationEventPublisher {
  readonly published: RecordedPublicationEvent[] = [];

  async publish(
    type: WebsiteEventType,
    payload: SitePublicationPayload,
    options: { readonly orderingKey: string },
  ): Promise<void> {
    this.published.push({ type, payload, orderingKey: options.orderingKey });
  }
}

export interface PublicationFakeInput {
  readonly sites?: InMemorySiteRepository;
  readonly versions?: InMemorySiteVersionRepository;
  readonly images?: SiteMediaChecker;
  readonly sections?: SiteSectionAvailability;
}

/** Publication dependencies with every read stubbed the same way, so a test only names what it varies. */
export function publicationFakes(input?: PublicationFakeInput): {
  readonly sites: InMemorySiteRepository;
  readonly versions: InMemorySiteVersionRepository;
  readonly images: SiteMediaChecker;
  readonly sections: SiteSectionAvailability;
  readonly unitOfWork: InlineUnitOfWork;
  readonly events: RecordingSitePublicationPublisher;
  readonly audit: InMemoryAuditRecorder;
  readonly clock: MutableClock;
} {
  return {
    sites: input?.sites ?? new InMemorySiteRepository(),
    versions: input?.versions ?? new InMemorySiteVersionRepository(),
    images: input?.images ?? new FakeSiteMediaChecker(),
    sections: input?.sections ?? new FakeSiteSectionAvailability([]),
    unitOfWork: new InlineUnitOfWork(),
    events: new RecordingSitePublicationPublisher(),
    audit: new InMemoryAuditRecorder(),
    clock: new MutableClock(),
  };
}

export type PublicationFakes = ReturnType<typeof publicationFakes>;
