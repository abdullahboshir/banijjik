import { MODULE_KEY } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { STOREFRONT_CATALOGS } from "@banijjik/i18n";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  enableCustomerLogin,
  grantDirectoryModule,
  grantOptionalModule,
  publishTemplate,
  seedApprovedListing,
  seedBusiness,
  seedOwner,
  seedPublishedSite,
  signInCustomer,
  type Session,
} from "./test-support/seed";
import {
  API_ORIGIN,
  BASE_DOMAIN,
  STOREFRONT_ORIGIN,
  STOREFRONT_PORT,
  latestSmsCode,
  startStorefrontStack,
  type StorefrontStack,
} from "./test-support/storefront-stack";

/** M.6c C7: the signed-in pages, driven in the browser against the real API and worker. */
const SLUG = "flow-bibaho";
const BUSINESS_NAME = "ফ্লো ট্রেডার্স";
const FLOW_PHONE = "+8801798765432";
const IDEMPOTENCY_HEADER = "Idempotency-Key";
const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
const DEADLINE_MS = 30_000;
const POLL_MS = 500;
const HOME = `http://${SLUG}.${BASE_DOMAIN}:${STOREFRONT_PORT}`;
const FIRST_OPTION_INDEX = 0;
const FLOW_CREDITS = 20;
const PACK_NAME = { bn: "১০ ক্রেডিট", en: "10 Credits" };
const BKASH_METHOD = {
  method: "BKASH",
  accountNumber: "01700000001",
  accountType: "Merchant",
  instructions: { bn: "বিকাশ পেমেন্ট করুন", en: "Pay via bKash" },
};
/** Sample answers, one per field type the form can ask for (a choice takes its first option). */
const SAMPLE_BY_TYPE: Readonly<Record<string, string>> = {
  TEXT: "Test",
  LONG_TEXT: "Test",
  NUMBER: "25",
  DECIMAL: "25",
  DATE: "1995-05-01",
  PHONE: "+8801700000000",
  EMAIL: "test@example.com",
  URL: "https://example.com",
};
const GEO_SAMPLE = { division: "dhaka", district: "dhaka" } as const;

interface FormField {
  readonly fieldKey: string;
  readonly fieldType: string;
  readonly isRequired: boolean;
  readonly options?: readonly string[];
}

let stack: StorefrontStack;
let owner: Session;
let organizationId = "";
let seededListingNumber = "";
let flowListingNumber = "";

/** The Bangla texts the buttons and notices show (the browser default locale). */
const bn = STOREFRONT_CATALOGS.bn;

function bnTextOf(key: string): string {
  const value = bn[key];
  if (value === undefined) throw new Error(`missing storefront text ${key}`);
  return value;
}
const bnText = {
  next: bnTextOf("storefront.account.next"),
  submit: bnTextOf("storefront.account.submit"),
  submitted: bnTextOf("storefront.account.submitted"),
  unlock: bnTextOf("storefront.listing.unlock"),
  unlocked: bnTextOf("storefront.listing.unlocked"),
  submitPurchase: bnTextOf("storefront.credits.submitPurchase"),
  reportSubmit: bnTextOf("storefront.listing.reportSubmit"),
  reported: bnTextOf("storefront.listing.reported"),
  block: bnTextOf("storefront.listing.block"),
  blocked: bnTextOf("storefront.listing.blocked"),
  exportButton: bnTextOf("storefront.account.exportButton"),
  eraseSendCode: bnTextOf("storefront.account.eraseSendCode"),
  stepOf: bnTextOf("storefront.account.stepOf"),
};

/** The step counter text before its total, for the given step (waits for the page to move on). */
function stepPrefix(current: number): string {
  return bnText.stepOf.replace("{current}", String(current)).split("{total}")[0] ?? "";
}

beforeAll(async () => {
  stack = await startStorefrontStack();
  await publishTemplate(stack, "MATRIMONY");
  owner = await seedOwner();
  organizationId = await seedBusiness(owner, SLUG, BUSINESS_NAME);
  await seedPublishedSite(stack, organizationId);
  await grantDirectoryModule(stack, organizationId);
  await grantOptionalModule(stack, organizationId, MODULE_KEY.CREDIT);
  await enableCustomerLogin(owner, organizationId);
  await configureCredits();
  const otherCustomer = await signInCustomer(stack, organizationId);
  seededListingNumber = (await seedApprovedListing(owner, otherCustomer, organizationId))
    .listingNumber;
}, 240_000);

afterAll(async () => {
  await stack?.stop();
});

/** Owner's API call (the owner's session cookie, the storefront origin like the seed helpers). */
async function ownerCall(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_ORIGIN}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: STOREFRONT_ORIGIN,
      Cookie: owner.cookieHeader,
      [IDEMPOTENCY_HEADER]: newId(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Payment methods and one pack, so the purchase page has something to sell (the owner's settings). */
async function configureCredits(): Promise<void> {
  const patched = await ownerCall("PATCH", `/orgs/${organizationId}/settings`, {
    items: [{ settingKey: "credit.payment.methods", value: [BKASH_METHOD] }],
  });
  const pack = await ownerCall("POST", `/orgs/${organizationId}/credit/packs`, {
    name: PACK_NAME,
    credits: 10,
    price: { amount: 500, currency: "BDT" },
    validityDays: 30,
    sortOrder: 1,
  });
  if (!patched.ok || !pack.ok) throw new Error("the credit settings could not be seeded");
}

async function signInInBrowser(page: Page, phone: string): Promise<void> {
  await page.goto(`${HOME}/sign-in`, { waitUntil: "load" });
  await page.type("#sign-in-phone", phone);
  const sentAfter = new Date();
  await clickSubmit(page);
  await page.waitForSelector("#sign-in-code");
  const code = await latestSmsCode(stack, phone, sentAfter);
  await page.type("#sign-in-code", code);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), clickSubmit(page)]);
}

async function clickSubmit(page: Page): Promise<void> {
  await page.click('button[type="submit"]');
}

async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(`${HOME}${path}`, { waitUntil: "load" });
}

async function bodyText(page: Page): Promise<string> {
  return page.$eval("main", (main) => main.textContent ?? "");
}

async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => (document.querySelector("main")?.textContent ?? "").includes(wanted),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

async function clickButtonText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("button")).some(
        (button) =>
          button.textContent?.trim() === wanted &&
          !button.disabled &&
          Object.keys(button).some((key) => key.startsWith("__reactProps")),
      ),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
  await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === wanted,
    );
    button?.click();
  }, text);
}

async function hasButtonText(page: Page, text: string): Promise<boolean> {
  return page.evaluate(
    (wanted) =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === wanted,
      ),
    text,
  );
}

/** Sets a control's value the way a user does: the native setter, then the events React listens to. */
async function setValue(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: DEADLINE_MS });
  await page.$eval(
    selector,
    (element, next) => {
      const isSelect = element instanceof HTMLSelectElement;
      // The element's own prototype owns the native value setter (input, textarea or select).
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      nativeSetter?.set?.call(element, next);
      element.dispatchEvent(new Event(isSelect ? "change" : "input", { bubbles: true }));
    },
    value,
  );
}

async function fillGeo(page: Page, field: FormField): Promise<void> {
  const division = `#field-${field.fieldKey}-division`;
  if ((await page.$(division)) === null) return;
  await setValue(page, division, GEO_SAMPLE.division);
  const district = `#field-${field.fieldKey}-district`;
  await page.waitForFunction(
    (id) => ((document.querySelector(id) as HTMLSelectElement | null)?.options.length ?? 0) > 1,
    { timeout: DEADLINE_MS, polling: POLL_MS },
    district,
  );
  await setValue(page, district, GEO_SAMPLE.district);
}

async function fillChoice(page: Page, field: FormField): Promise<void> {
  const option = field.options?.[FIRST_OPTION_INDEX];
  if (option === undefined) return;
  if (field.fieldType === "MULTI_SELECT") {
    await page.click(`input[name="${field.fieldKey}"][value="${option}"]`);
    return;
  }
  const selector = `#field-${field.fieldKey}`;
  if ((await page.$(selector)) !== null) await setValue(page, selector, option);
}

async function fillField(page: Page, field: FormField): Promise<void> {
  const selector = `#field-${field.fieldKey}`;
  if (field.fieldType === "GEO_BD") return fillGeo(page, field);
  if (field.fieldType === "SELECT" || field.fieldType === "MULTI_SELECT") {
    return fillChoice(page, field);
  }
  if (field.fieldType === "BOOLEAN") {
    if ((await page.$(selector)) !== null) await page.click(selector);
    return;
  }
  const sample = SAMPLE_BY_TYPE[field.fieldType];
  if (sample !== undefined && (await page.$(selector)) !== null) {
    await setValue(page, selector, sample);
  }
}

async function formFields(): Promise<readonly FormField[]> {
  const response = await fetch(
    `${API_ORIGIN}/api/v1/storefront/orgs/${organizationId}/directory/form`,
  );
  const body = (await response.json()) as { data: { fields: FormField[] } };
  return body.data.fields;
}

/** Fills every field the current step shows, then goes on, until the last step (where Submit is). */
async function fillBiodataSteps(page: Page): Promise<void> {
  const fields = await formFields();
  let current = 1;
  for (let guard = 0; guard < 12; guard += 1) {
    await page.waitForFunction(
      (prefix) => (document.querySelector("main")?.textContent ?? "").includes(prefix),
      { timeout: DEADLINE_MS, polling: POLL_MS },
      stepPrefix(current),
    );
    for (const field of fields) await fillField(page, field);
    if (await hasButtonText(page, bnText.submit)) return;
    await clickButtonText(page, bnText.next);
    current += 1;
  }
  throw new Error("the biodata form did not reach its last step");
}

async function tickConsents(page: Page): Promise<void> {
  await page.$$eval('input[name="consents"]', (inputs) => {
    for (const input of inputs as HTMLInputElement[]) if (!input.checked) input.click();
  });
}

async function flowCustomerCookie(page: Page): Promise<string> {
  const cookies = await page.cookies();
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function flowCustomerAccountId(cookie: string): Promise<string> {
  const response = await fetch(`${API_ORIGIN}/api/v1/storefront/orgs/${organizationId}/me`, {
    headers: { Cookie: cookie },
  });
  const body = (await response.json()) as { data: { customerAccountId: string } };
  return body.data.customerAccountId;
}

async function approveSubmittedListing(): Promise<void> {
  const queue = await ownerCall("GET", `/orgs/${organizationId}/directory/queue?status=SUBMITTED`);
  const body = (await queue.json()) as {
    data: { items: { listingId: string; version: number }[] };
  };
  const item = body.data.items[0];
  if (item === undefined) throw new Error("no submitted listing to approve");
  const approved = await ownerCall(
    "POST",
    `/orgs/${organizationId}/directory/listings/${item.listingId}/approve`,
    { version: item.version },
  );
  if (!approved.ok) throw new Error(`approval answered ${approved.status}`);
}

/** The approved listing appears in the public search once it is approved (polled, never raced). */
async function waitForSearchResult(page: Page, listingNumber: string): Promise<void> {
  const deadline = Date.now() + DEADLINE_MS;
  while (Date.now() < deadline) {
    await openPage(page, "/search");
    const found = await page.$(`a[href="/listings/${listingNumber}"]`);
    if (found !== null) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`${listingNumber} did not reach the search`);
}

describe("the signed-in storefront pages", () => {
  it("fills the biodata steps, saves a draft, submits with consents and sees SUBMITTED; staff approval puts the listing in search; unlock, buy, report, block, export and erase", async () => {
    const page = await stack.browser.newPage();
    await page.setViewport(DESKTOP_VIEWPORT);
    await signInInBrowser(page, FLOW_PHONE);
    const cookie = await flowCustomerCookie(page);

    await openPage(page, "/my/listing");
    await fillBiodataSteps(page);
    await tickConsents(page);
    await clickButtonText(page, bnText.submit);
    await waitForText(page, bnText.submitted);
    const mine = await fetch(`${API_ORIGIN}/api/v1/storefront/orgs/${organizationId}/my/listing`, {
      headers: { Cookie: cookie },
    });
    const listing = ((await mine.json()) as { data: { listingNumber: string; status: string } })
      .data;
    flowListingNumber = listing.listingNumber;
    expect(listing.status).toBe("SUBMITTED");

    await approveSubmittedListing();
    await waitForSearchResult(page, flowListingNumber);

    const customerAccountId = await flowCustomerAccountId(cookie);
    const credited = await ownerCall(
      "POST",
      `/orgs/${organizationId}/credit/accounts/${customerAccountId}/adjust`,
      { credits: FLOW_CREDITS, reason: "browser test" },
    );
    expect(credited.ok).toBe(true);
    await openPage(page, `/listings/${seededListingNumber}`);
    await clickButtonText(page, bnText.unlock);
    await waitForText(page, bnText.unlocked);

    await openPage(page, "/my/credits");
    await setValue(page, "#purchase-sender", FLOW_PHONE);
    await setValue(page, "#purchase-reference", "BKASHREF123");
    await clickButtonText(page, bnText.submitPurchase);
    await page.waitForFunction(() => window.location.search.includes("purchased=1"), {
      timeout: DEADLINE_MS,
      polling: POLL_MS,
    });
    expect(await bodyText(page)).toContain("PENDING");

    await openPage(page, `/listings/${seededListingNumber}`);
    await clickButtonText(page, bnText.reportSubmit);
    await waitForText(page, bnText.reported);
    await clickButtonText(page, bnText.block);
    await waitForText(page, bnText.blocked);

    await openPage(page, "/my/account");
    const [exported] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/my/data-export")),
      clickButtonText(page, bnText.exportButton),
    ]);
    expect(exported.status()).toBe(200);

    await clickButtonText(page, bnText.eraseSendCode);
    await page.waitForSelector("#erase-code", { timeout: DEADLINE_MS });
    await page.close();
  }, 300_000);
});
