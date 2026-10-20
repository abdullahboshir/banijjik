import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyText, gotoWhenHydrated, message, waitForText } from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import {
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const SLUG = "dirco";
const ORG_NAME = "ডিরেক্টরি কো";
const PRIVATE_VALUE = "গোপন-নাম-পরীক্ষা";
const LISTING_NUMBER = "BD-1";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId = "";
let listingId = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রিভিউয়ার আলী");
  await seedOrganization(owner, SLUG, ORG_NAME);
  organizationId = await organizationIdOf(SLUG);
  await grantDirectory(organizationId);
  await seedDirectoryTemplate(organizationId);
  await createListingFields(organizationId);
  listingId = await insertSubmittedListing(organizationId);
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

async function organizationIdOf(slug: string): Promise<string> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const row = await client.db("browser_platform").collection("organizations").findOne({ slug });
    if (row === null) throw new Error(`org ${slug} missing`);
    return String(row["organizationId"]);
  } finally {
    await client.close();
  }
}

async function grantDirectory(organizationId: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const now = new Date();
    await client.db("browser_platform").collection("module_overrides").insertOne({
      moduleOverrideId: newId(),
      organizationId: organizationId,
      moduleKey: MODULE_KEY.DIRECTORY,
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
      .updateOne({ organizationId: organizationId }, { $inc: { configVersion: 1 } });
  } finally {
    await client.close();
  }
}

async function seedDirectoryTemplate(organizationId: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const org = await client
      .db("browser_platform")
      .collection("organizations")
      .findOne({ organizationId: organizationId });
    if (org === null) throw new Error("org missing");
    await client
      .db("browser_platform")
      .collection("industry_templates")
      .updateOne(
        { industryTemplateKey: org.industryTemplateKey },
        {
          $set: {
            "configuration.directory": {
              sections: [{ sectionKey: "basics", label: { bn: "মূল", en: "Basics" } }],
              consents: [],
              rejectionReasons: [
                {
                  reasonKey: "unclear",
                  label: { bn: "অস্পষ্ট উত্তর", en: "Unclear" },
                  isFinal: false,
                },
              ],
              listingNumberPrefix: "BD",
            },
          },
          $inc: { version: 1 },
        },
      );
  } finally {
    await client.close();
  }
}

async function createListingFields(organizationId: string): Promise<void> {
  const cookies = owner.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  for (const field of [
    {
      entityType: "listing",
      fieldKey: "age_band",
      fieldType: "SELECT",
      label: { bn: "বয়স", en: "Age" },
      isRequired: true,
      options: ["20", "25", "30"],
      visibility: { admin: true, storefront: true, bot: false },
      botAsk: false,
      isSearchable: false,
      isSensitive: false,
      sortOrder: 1,
      listingTier: "PUBLIC",
      sectionKey: "basics",
    },
    {
      entityType: "listing",
      fieldKey: "own_name",
      fieldType: "TEXT",
      label: { bn: "নিজের নাম", en: "Own name" },
      isRequired: false,
      visibility: { admin: true, storefront: true, bot: false },
      botAsk: false,
      isSearchable: false,
      isSensitive: false,
      sortOrder: 2,
      listingTier: "PRIVATE",
      sectionKey: "basics",
    },
  ]) {
    const response = await fetch(
      `http://localhost:4000/api/v1/orgs/${organizationId}/custom-fields`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookies,
          origin: "http://localhost:3101",
        },
        body: JSON.stringify(field),
      },
    );
    if (response.status !== 201) {
      throw new Error(`field ${field.fieldKey} failed: ${response.status}`);
    }
  }
}

async function insertSubmittedListing(organizationId: string): Promise<string> {
  const id = newId();
  const now = new Date();
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    await client
      .db("browser_tenant")
      .collection("directory_listings")
      .insertOne({
        listingId: id,
        organizationId: organizationId,
        listingNumber: LISTING_NUMBER,
        ownerCustomerAccountId: newId(),
        status: "SUBMITTED",
        customFields: { age_band: "25", own_name: PRIVATE_VALUE },
        customFieldSearch: [{ fieldKey: "age_band", value: "25" }],
        photoFileIds: [],
        consentsAccepted: [],
        submittedAt: now,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdByUserId: null,
        updatedByUserId: null,
      });
  } finally {
    await client.close();
  }
  return id;
}

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

describe("directory moderation screens", () => {
  it("reviews a listing: queue, private tier, reject, approve, find in all listings", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, `/${SLUG}/directory/queue`, "main");
    await waitForText(page, LISTING_NUMBER);
    expect(await bodyText(page)).toContain(message("directory.queue.open"));

    await gotoWhenHydrated(page, `/${SLUG}/directory/listings/${listingId}`, "main");
    await waitForText(page, message("directory.tier.PRIVATE"));
    expect(await bodyText(page)).toContain(PRIVATE_VALUE);
    expect(await bodyText(page)).toContain("শুধু অফিস");

    await clickByName(page, message("directory.action.reject"));
    await waitForText(page, "অস্পষ্ট উত্তর");
    await page.evaluate(() => {
      const labels = [...document.querySelectorAll("label")];
      const reason = labels.find((label) => label.textContent?.includes("অস্পষ্ট উত্তর"));
      const input = reason?.querySelector("input[type=checkbox]");
      if (input instanceof HTMLInputElement) input.click();
    });
    await clickByName(page, message("directory.reject.submit"));
    await page.waitForFunction(() => location.pathname.endsWith("/directory/queue"));
    await gotoWhenHydrated(page, `/${SLUG}/directory/queue`, "main");
    expect(await bodyText(page)).not.toContain(LISTING_NUMBER);

    const client = await MongoClient.connect(stack.mongoUri);
    try {
      await client
        .db("browser_tenant")
        .collection("directory_listings")
        .updateOne(
          { listingId },
          {
            $set: { status: "SUBMITTED", submittedAt: new Date() },
            $unset: { rejection: "", reviewedAt: "", reviewedByUserId: "" },
            $inc: { version: 1 },
          },
        );
    } finally {
      await client.close();
    }

    await gotoWhenHydrated(page, `/${SLUG}/directory/listings/${listingId}`, "main");
    await clickByName(page, message("directory.action.approve"));
    await waitForDialogSettled(page);
    await clickByName(page, message("common.confirm"));
    await page.waitForFunction(() => location.pathname.endsWith("/directory/queue"));

    await gotoWhenHydrated(page, `/${SLUG}/directory/listings?status=APPROVED`, "main");
    await waitForText(page, LISTING_NUMBER);
    expect(await bodyText(page)).toContain(message("directory.status.APPROVED"));

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);
    await closePage(page);
  }, 180_000);

  it("keeps directory routes within the initial JS budget", async () => {
    const page = await ownerPage();
    for (const path of [
      `/${SLUG}/directory/queue`,
      `/${SLUG}/directory/listings`,
      `/${SLUG}/directory/listings/${listingId}`,
    ]) {
      const size = await measureInitialJs(page, path);
      expect(toKiB(size.gzipBytes), path).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    }
    await closePage(page);
  }, 120_000);
});
