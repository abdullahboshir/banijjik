import type { SitePageKey } from "@banijjik/contracts/website";
import type { SitePage } from "../../domain/site-page.entity.js";

/** Pages of the calling organization only: the tenant plugin scopes every read and write. */
export interface SitePageRepository {
  findByKey(pageKey: SitePageKey): Promise<SitePage | undefined>;
  listAll(): Promise<SitePage[]>;
  listPublished(): Promise<SitePage[]>;
  /** `duplicate` when the page key already has a row (a concurrent first save). */
  insert(page: SitePage): Promise<"inserted" | "duplicate">;
  /** Writes only when the stored version is `expectedVersion`; otherwise a 409 conflict. */
  save(page: SitePage, expectedVersion: number): Promise<void>;
}
