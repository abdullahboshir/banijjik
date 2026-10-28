import {
  SITE_PAGE_KEY,
  type SitePageKey,
  type StorefrontSitePageResponse,
} from "@banijjik/contracts/website";
import type { WebsiteVersionId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { models } from "../../../../kernel/db/index.js";
import type { WebsiteVersionReader } from "../application/ports/website-version-reader.js";
import {
  WEBSITE_VERSION_MODEL_NAME,
  type WebsiteVersionDocument,
} from "./website-version.schema.js";

const PAGE_KEYS = new Set<string>(Object.values(SITE_PAGE_KEY));

function versionModel(): Model<WebsiteVersionDocument> {
  return models({}).get<WebsiteVersionDocument>(WEBSITE_VERSION_MODEL_NAME);
}

function isLocalized(value: unknown): value is { bn: string; en: string } {
  if (typeof value !== "object" || value === null) return false;
  const text = value as { bn?: unknown; en?: unknown };
  return typeof text.bn === "string" && typeof text.en === "string";
}

function storefrontPageOf(row: unknown): StorefrontSitePageResponse | undefined {
  if (typeof row !== "object" || row === null) return undefined;
  const candidate = row as {
    pageKey?: unknown;
    title?: unknown;
    body?: unknown;
    includeInPublication?: unknown;
  };
  if (candidate.includeInPublication === false) return undefined;
  if (typeof candidate.pageKey !== "string" || !PAGE_KEYS.has(candidate.pageKey)) return undefined;
  if (!isLocalized(candidate.title) || !isLocalized(candidate.body)) return undefined;
  return {
    pageKey: candidate.pageKey as SitePageKey,
    title: candidate.title,
    body: candidate.body,
  };
}

function pagesOf(design: unknown): readonly StorefrontSitePageResponse[] {
  if (typeof design !== "object" || design === null) return [];
  const staticContent = (design as { staticContent?: unknown }).staticContent;
  if (!Array.isArray(staticContent)) return [];
  const pages: StorefrontSitePageResponse[] = [];
  for (const row of staticContent) {
    const page = storefrontPageOf(row);
    if (page !== undefined) pages.push(page);
  }
  return pages;
}

export class MongoWebsiteVersionReader implements WebsiteVersionReader {
  async findStaticPages(
    websiteVersionId: WebsiteVersionId,
  ): Promise<readonly StorefrontSitePageResponse[] | undefined> {
    const row = await versionModel().findOne({ websiteVersionId }).lean<WebsiteVersionDocument>();
    return row === null ? undefined : pagesOf(row.design);
  }
}
