import { SITE_DESIGN_BOUNDS } from "./site-design.js";

/**
 * The schema versions a stored snapshot may carry. A reader that meets another version fails
 * closed: deployment rollback stays compatible with the previous release, never renders unchecked
 * JSON (phase-4-assurance "Release and rollback").
 */
export const SUPPORTED_SITE_SCHEMA_VERSIONS: readonly number[] = [SITE_DESIGN_BOUNDS.schemaVersion];

export function isSupportedSiteSchemaVersion(schemaVersion: number): boolean {
  return SUPPORTED_SITE_SCHEMA_VERSIONS.includes(schemaVersion);
}

/** One row of `GET /versions`: the list is projected metadata, never the stored snapshots. */
export interface SiteVersionMetadata {
  readonly websiteVersionId: string;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly sourceTemplateKey: string;
  readonly sourceTemplateRevision: number;
  readonly publishedByUserId: string | null;
  readonly publishedAt: string;
}

/** A page of that metadata, newest first, with the window the caller asked for (P4-18). */
export interface SiteVersionListResponse {
  readonly items: readonly SiteVersionMetadata[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}
