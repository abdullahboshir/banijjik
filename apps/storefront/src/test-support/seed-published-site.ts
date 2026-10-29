import {
  CONSERVATIVE_PAGE_RULES,
  SITE_PAGE_KEY,
  STATIC_CONTENT_REGION_PREFIX,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { MongoClient } from "mongodb";
import type { StorefrontStack } from "./storefront-stack";

const SITE_TEXT = { bn: "শিরোনাম", en: "Title" };
const SITE_TOKENS = {
  color: {
    primary: "#15803d",
    accent: "#16a34a",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    mutedText: "#334155",
    onPrimary: "#ffffff",
    focus: "#1d4ed8",
  },
  type: { fontPairKey: "inter-noto", scale: "MEDIUM" },
  shape: {
    cardRadius: "MEDIUM",
    buttonRadius: "MEDIUM",
    inputRadius: "SMALL",
    imageRadius: "SMALL",
    border: "THIN",
    shadow: "LOW",
  },
  spacing: { density: "COMFORTABLE" },
  size: {
    imageRatio: "LANDSCAPE",
    cardSize: "MEDIUM",
    columns: { mobile: 1, tablet: 2, desktop: 3 },
  },
};

function chrome(sectionKey: "header" | "footer") {
  return {
    sectionId: newId(),
    sectionKey,
    variantKey: "SIMPLE",
    regionKey: sectionKey,
    binding: null,
    content: { links: [{ label: SITE_TEXT, path: "/home" }] },
  };
}

function publishedSiteDraft() {
  return {
    schemaVersion: 1,
    tokens: SITE_TOKENS,
    header: chrome("header"),
    footer: chrome("footer"),
    pages: [
      {
        pageId: newId(),
        path: "/home",
        title: SITE_TEXT,
        seo: { description: SITE_TEXT, noIndex: false },
        sections: [
          {
            sectionId: newId(),
            sectionKey: "hero",
            variantKey: "SPLIT",
            regionKey: "main",
            binding: null,
            content: { heading: SITE_TEXT, body: SITE_TEXT },
          },
        ],
      },
    ],
    staticContent: [],
  };
}

function publishedSitePolicy() {
  return {
    regions: [
      {
        regionKey: "header",
        lock: "LOCKED",
        required: true,
        sectionKeys: ["header"],
        maxSections: 1,
        editableContentKeys: [],
      },
      {
        regionKey: "footer",
        lock: "FULL",
        required: true,
        sectionKeys: ["footer"],
        maxSections: 1,
        editableContentKeys: ["links"],
      },
      {
        regionKey: "main",
        lock: "FULL",
        required: false,
        sectionKeys: ["hero", "rich-text", "offering-grid", "directory-list"],
        maxSections: 5,
        editableContentKeys: [],
      },
      ...Object.values(SITE_PAGE_KEY).map((pageKey) => ({
        regionKey: `${STATIC_CONTENT_REGION_PREFIX}${pageKey}`,
        lock: "FULL" as const,
        required: false,
        sectionKeys: [] as string[],
        maxSections: 1,
        editableContentKeys: ["title", "body"],
      })),
    ],
    tokenGroups: { color: true, type: true, shape: true, spacing: true, size: true },
    allowedColors: null,
    allowedVariantsBySection: {
      header: ["SIMPLE"],
      footer: ["SIMPLE", "COLUMNS"],
      hero: ["SPLIT", "CENTERED"],
      "rich-text": ["STANDARD"],
      "offering-grid": ["GRID"],
      "directory-list": ["GRID"],
    },
    pageRules: CONSERVATIVE_PAGE_RULES,
  };
}

/**
 * Host resolution (4.2 C1) only serves a business that has a published Site pointer. 4.5 creates
 * that row in production; the browser stack inserts the same shape the admin domain wizard seeds.
 * `hasPublishedOnce` stays false so `/site` still lists the legacy static pages this suite publishes.
 * If a Site already exists (legacy `/website/pages` writes), only the published pointer is set so
 * the page API is not put into siteVersion CAS.
 */
export async function seedPublishedSite(
  stack: StorefrontStack,
  organizationId: string,
): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const now = new Date();
    const sites = client.db("browser_tenant").collection("sites");
    const publishedWebsiteVersionId = newId();
    const updated = await sites.updateOne(
      { organizationId },
      { $set: { publishedWebsiteVersionId, updatedAt: now } },
    );
    if (updated.matchedCount > 0) return;
    await sites.insertOne({
      siteId: newId(),
      organizationId,
      draftDesign: publishedSiteDraft(),
      editPolicy: publishedSitePolicy(),
      sourceTemplateKey: "retail-starter",
      sourceTemplateRevision: 1,
      publishedWebsiteVersionId,
      nextRevision: 1,
      hasPublishedOnce: false,
      canonicalSiteDomainId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });
  } finally {
    await client.close();
  }
}
