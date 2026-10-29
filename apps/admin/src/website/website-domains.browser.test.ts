import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import {
  CONSERVATIVE_PAGE_RULES,
  SITE_PAGE_KEY,
  STATIC_CONTENT_REGION_PREFIX,
} from "@banijjik/contracts/website";
import { newId } from "@banijjik/ids";
import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createInvitationThroughUi,
  gotoWhenHydrated,
  message,
  signUpAsInvitee,
  waitForPath,
  waitForText,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import {
  ADMIN_ORIGIN,
  organizationIdOf,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { measureInitialJs, toKiB } from "../test-support/initial-js-size";

const ADMIN_ROUTE_BUDGET_KIB = 180;
const SLUG = "acme";
const ORG_NAME = "অ্যাক্মে";
const PAGE_PATH = `/${SLUG}/website/domains`;
const STAFF_ROLE = "স্টাফ";
const STAFF_NAME = "স্টাফ সদস্য";
const SITE_TEXT = { bn: "শিরোনাম", en: "Title" };

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("ডোমেইন মালিক");
  await seedOrganization(owner, SLUG, ORG_NAME);
  organizationId = await organizationIdOf(owner, SLUG);
  await grantWebsiteModule(organizationId);
  await seedDraftSite(organizationId);
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

async function grantWebsiteModule(organizationIdToGrant: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const now = new Date();
    await client.db("browser_platform").collection("module_overrides").insertOne({
      moduleOverrideId: newId(),
      organizationId: organizationIdToGrant,
      moduleKey: MODULE_KEY.WEBSITE,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
      reason: "browser test",
      expiresAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });
    await client
      .db("browser_platform")
      .collection("organizations")
      .updateOne({ organizationId: organizationIdToGrant }, { $inc: { configVersion: 1 } });
  } finally {
    await client.close();
  }
}

function siteTokens() {
  return {
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
}

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

function draftDesign() {
  return {
    schemaVersion: 1,
    tokens: siteTokens(),
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

function editPolicy() {
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

/** Site.create is not a production API until 4.5; the wizard needs a Site row to add a domain. */
async function seedDraftSite(organizationIdToSeed: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const now = new Date();
    await client.db("browser_tenant").collection("sites").insertOne({
      siteId: newId(),
      organizationId: organizationIdToSeed,
      draftDesign: draftDesign(),
      editPolicy: editPolicy(),
      sourceTemplateKey: "retail-starter",
      sourceTemplateRevision: 1,
      publishedWebsiteVersionId: null,
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

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

describe("the website domain wizard", () => {
  it("lets the owner add a hostname and shows it as waiting for DNS", async () => {
    const hostname = `shop-${newId().replace(/-/g, "").slice(0, 12)}.example.com`;
    const page = await ownerPage();
    await gotoWhenHydrated(page, PAGE_PATH, "#domain-hostname");
    await page.type("#domain-hostname", hostname);
    await clickByName(page, message("website.domains.add"));
    await waitForText(page, hostname);
    await waitForText(page, message("website.domains.status.PENDING"));
    await closePage(page);
  });

  it("shows staff the permission-denied empty state", async () => {
    const inviter = await ownerPage();
    const memberEmail = `staff-${Date.now()}@example.com`;
    const link = await createInvitationThroughUi(inviter, {
      identifier: memberEmail,
      displayName: STAFF_NAME,
      roleName: STAFF_ROLE,
    });
    await closePage(inviter);

    const staff = await openPage(stack.browser, PHONE_VIEWPORT);
    await signUpAsInvitee(staff, link, { name: STAFF_NAME, email: memberEmail });
    await waitForPath(staff, new URL(link).pathname);
    await clickByName(staff, message("accept.submit"));
    await waitForPath(staff, `/${SLUG}`);
    await staff.goto(`${ADMIN_ORIGIN}${PAGE_PATH}`, { waitUntil: "domcontentloaded" });
    await waitForText(staff, message("state.permissionDenied"));
    await closePage(staff);
  }, 120_000);

  it("stays within the initial JavaScript budget of the page route", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, PAGE_PATH, "#domain-hostname");
    const size = await measureInitialJs(page, PAGE_PATH);
    process.stdout.write(`initial JS website domains: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), "website domains").toBeLessThanOrEqual(ADMIN_ROUTE_BUDGET_KIB);
  });
});
