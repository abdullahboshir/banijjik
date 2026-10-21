import { IDEMPOTENCY_KEY_HEADER, MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { CUSTOMER_ACCOUNT_STATUS } from "@banijjik/contracts/contact";
import { newId } from "@banijjik/ids";
import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, it } from "vitest";
import { fillLabel } from "../catalog/catalog-labels";
import {
  clickButton,
  gotoWhenHydrated,
  message,
  waitForText,
} from "../test-support/browser-helpers";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForHydration,
} from "../test-support/browser-page";
import {
  ADMIN_ORIGIN,
  API_PORT,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

const ORG_SLUG = "acme";
const BUSINESS_NAME = "ক্রেডিট টেস্ট";
const CONTACT_NAME = "ক্রেডিট গ্রাহক";
const CONTACT_PHONE = "+8801712345678";
const PACK_NAME_BN = "ছোট প্যাক";
const PACK_NAME_EN = "Small pack";
const PACK_CREDITS = "25";
const PACK_PRICE = "500";
const PACK_VALIDITY_DAYS = "30";
const ADJUST_CREDITS = "5";
const ADJUST_REASON = "ব্রাউজার টেস্ট উপহার";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let contactId: string;

interface ContactCreateAnswer {
  data: { contactId: string };
}

async function createContact(): Promise<string> {
  const cookieHeader = owner.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const response = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/contacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ADMIN_ORIGIN,
        [IDEMPOTENCY_KEY_HEADER]: newId(),
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        contactType: "PERSON",
        name: CONTACT_NAME,
        phoneE164: CONTACT_PHONE,
        contactRoles: ["CUSTOMER"],
      }),
    },
  );
  if (!response.ok) throw new Error(`POST contacts answered ${response.status}`);
  const body = (await response.json()) as ContactCreateAnswer;
  return body.data.contactId;
}

function moduleOverride(moduleKey: string, now: Date): object {
  return {
    moduleOverrideId: newId(),
    organizationId,
    moduleKey,
    effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
    reason: "browser test",
    expiresAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: null,
    updatedByUserId: null,
  };
}

/** Grants the optional directory and credit modules and links a website login to a new contact. */
async function seedCreditWorld(): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const platform = client.db("browser_platform");
    const organization = await platform.collection("organizations").findOne({ slug: ORG_SLUG });
    if (!organization) throw new Error(`No business with slug ${ORG_SLUG}`);
    organizationId = organization["organizationId"] as string;
    const now = new Date();
    // A published template does not list the optional modules the credit track needs (ADR-130).
    await platform.collection("industry_templates").updateMany({}, {
      $addToSet: { allowedModuleKeys: { $each: [MODULE_KEY.DIRECTORY, MODULE_KEY.CREDIT] } },
    } as never);
    await platform
      .collection("module_overrides")
      .insertMany([
        moduleOverride(MODULE_KEY.DIRECTORY, now),
        moduleOverride(MODULE_KEY.CREDIT, now),
      ]);
    // The resolver caches the configuration under this version: bump it so the next page sees the modules.
    await platform
      .collection("organizations")
      .updateOne({ slug: ORG_SLUG }, { $inc: { configVersion: 1 } });
    contactId = await createContact();
    await client.db("browser_tenant").collection("customer_accounts").insertOne({
      customerAccountId: newId(),
      organizationId,
      contactId,
      phoneE164: CONTACT_PHONE,
      status: CUSTOMER_ACCOUNT_STATUS.ACTIVE,
      verifiedAt: now,
      lastLoginAt: now,
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

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("ক্রেডিট মালিক");
  await seedOrganization(owner, ORG_SLUG, BUSINESS_NAME);
  await seedCreditWorld();
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

async function typeInto(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForSelector(selector);
  await page.type(selector, text);
}

/** Centred, so a button at the bottom edge does not sit under the fixed bottom navigation. */
function clickMainButton(page: Page, name: string): Promise<void> {
  return clickButton(page, "main button", (text) => text === name);
}

describe("credit screens", () => {
  it("creates a pack and adjusts a contact's credits as the owner", async () => {
    const page = await ownerPage();

    await gotoWhenHydrated(page, `/${ORG_SLUG}/credit/packs`, "main");
    await clickMainButton(page, message("credit.packs.add"));
    await typeInto(page, "#credit-pack-name-bn", PACK_NAME_BN);
    await typeInto(page, "#credit-pack-name-en", PACK_NAME_EN);
    await typeInto(page, "#credit-pack-credits", PACK_CREDITS);
    await typeInto(page, "#credit-pack-price", PACK_PRICE);
    await typeInto(page, "#credit-pack-validity", PACK_VALIDITY_DAYS);
    await clickMainButton(page, message("credit.packs.save"));
    await page.waitForFunction(() => document.querySelector("#credit-pack-name-bn") === null);
    await page.waitForFunction(
      (name) =>
        Array.from(document.querySelectorAll("main ul li")).some((row) =>
          row.textContent?.includes(name),
        ),
      {},
      PACK_NAME_BN,
    );
    await waitForText(page, message("credit.packs.status.ACTIVE"));

    await gotoWhenHydrated(page, `/${ORG_SLUG}/contacts/${contactId}`, "main");
    await page.waitForSelector("#credit-adjust-amount");
    // The credits section streams in after the shell: typing before this would be wiped by hydration.
    await waitForHydration(page, "#credit-adjust-amount");
    await typeInto(page, "#credit-adjust-amount", ADJUST_CREDITS);
    await typeInto(page, "#credit-adjust-reason", ADJUST_REASON);
    await clickMainButton(page, message("contacts.credits.adjustSubmit"));
    await waitForText(
      page,
      fillLabel(message("contacts.credits.balanceValue"), { balance: ADJUST_CREDITS }),
    );
    await waitForText(page, message("contacts.credits.adjusted"));
    await waitForText(page, ADJUST_REASON);
    await closePage(page);
  }, 180_000);
});
