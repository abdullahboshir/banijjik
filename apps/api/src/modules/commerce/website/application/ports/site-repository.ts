import type { Site } from "../../domain/site.entity.js";

/** The calling organization's site: the tenant plugin scopes every read and write. */
export interface SiteRepository {
  findCurrent(): Promise<Site | undefined>;
  /** `duplicate` when the organization already has a site (unique organizationId). */
  insert(site: Site): Promise<"inserted" | "duplicate">;
  /** Writes only when the stored version is `expectedVersion`; otherwise a 409 conflict. */
  save(site: Site, expectedVersion: number): Promise<void>;
}
