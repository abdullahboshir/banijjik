import type {
  SitePublicationPayload,
  SiteVersionMetadata,
  WebsiteEventType,
} from "@banijjik/contracts/website";
import type { SiteId, WebsiteVersionId } from "@banijjik/ids";
import type { WebsiteVersion } from "../../domain/website-version.entity.js";

/** The publication repository. A version row is append-only, so there is no update and no delete. */
export interface SiteVersionRepository {
  insert(version: WebsiteVersion): Promise<"inserted" | "duplicate">;
  findById(websiteVersionId: WebsiteVersionId): Promise<WebsiteVersion | undefined>;
  /**
   * One page of version metadata for one site, newest first. `siteId` is part of the filter because
   * the index starts with the organization and the site (P4-18); the snapshots themselves never leave
   * the repository as a list.
   */
  listMetadata(input: {
    readonly siteId: SiteId;
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly items: readonly SiteVersionMetadata[]; readonly total: number }>;
}

/**
 * Can this organization show these files on a public page? The adapter is the file module's
 * reference reader: an active file of a public purpose that belongs to this organization (decision 6).
 */
export interface SiteMediaChecker {
  filterUsable(fileIds: readonly string[]): Promise<ReadonlySet<string>>;
}

/** The section keys the current resolver allows, so a disabled module cannot be published or served. */
export interface SiteSectionAvailability {
  effectiveSectionKeys(): Promise<readonly string[]>;
}

/**
 * The transaction seam of publication: the snapshot, the pointer, the audit row and the outbox event
 * commit together or not at all (decision 2, ADR-090).
 */
export interface SitePublicationUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

/** Outbox payload is identifiers only (decision 15); the kernel publisher satisfies this port. */
export interface SitePublicationEventPublisher {
  publish(
    type: WebsiteEventType,
    payload: SitePublicationPayload,
    options: { readonly orderingKey: string },
  ): Promise<void>;
}
