import { CURRENCY_CODE } from "@banijjik/contracts";
import { WEBSITE_CHECKOUT_ENABLED_SETTING_KEY } from "@banijjik/contracts/website";
import { STOREFRONT_CATALOGS } from "@banijjik/i18n";
import { newId } from "@banijjik/ids";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishTemplate, seedOwner, seedPublishedSite, type Session } from "./test-support/seed";
import {
  API_ORIGIN,
  BASE_DOMAIN,
  STOREFRONT_ORIGIN,
  STOREFRONT_PORT,
  startStorefrontStack,
  type StorefrontStack,
} from "./test-support/storefront-stack";

/** Card 4.3 Part V: the public commerce flow in a real browser, against the real API and worker. */
const SLUG = "commerce-dokan";
const BUSINESS_NAME = "কমার্স দোকান";
const PRODUCT_NAME = "Cotton T-Shirt";
const PRODUCT_SLUG = "cotton-tshirt";
const PRODUCT_PRICE = 2500;
const RAISED_PRICE = 3000;
const CUSTOMER_NAME = "করিম আহমেদ";
const CUSTOMER_PHONE = "+8801712345678";
const MOBILE_VIEWPORT = { width: 360, height: 800, isMobile: true, hasTouch: true } as const;
const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
const MIN_TOUCH_TARGET_PX = 44;
const DEADLINE_MS = 30_000;
const POLL_MS = 250;
const IDEMPOTENCY_HEADER = "Idempotency-Key";
const HOME = `http://${SLUG}.${BASE_DOMAIN}:${STOREFRONT_PORT}`;
const BDT = CURRENCY_CODE.BDT;

const bn = STOREFRONT_CATALOGS.bn;

function bnTextOf(key: string): string {
  const value = bn[key];
  if (value === undefined) throw new Error(`missing storefront text ${key}`);
  return value;
}

const bnText = {
  addToCart: bnTextOf("storefront.catalog.addToCart"),
  addedToCart: bnTextOf("storefront.catalog.addedToCart"),
  proceed: bnTextOf("storefront.cart.proceedToCheckout"),
  priceChangedTitle: bnTextOf("storefront.checkout.priceChangedTitle"),
  acceptPriceChange: bnTextOf("storefront.checkout.acceptPriceChange"),
  placeOrder: bnTextOf("storefront.checkout.placeOrder"),
  receiptTitle: bnTextOf("storefront.requests.checkoutTitle"),
};

let stack: StorefrontStack;
let owner: Session;
let organizationId = "";
let locationId = "";
let offeringId = "";
let offeringVersion = 0;
let variantId = "";

beforeAll(async () => {
  stack = await startStorefrontStack();
  await publishTemplate(stack, "RETAIL");
  owner = await seedOwner();
  organizationId = await createBusiness();
  locationId = await defaultLocationId();
  await seedPublishedSite(stack, organizationId);
  await enableCheckout();
  await publishProduct();
}, 240_000);

afterAll(async () => {
  await stack?.stop();
});

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

async function createBusiness(): Promise<string> {
  const created = await ownerCall("POST", "/me/orgs", {
    name: BUSINESS_NAME,
    slug: SLUG,
    industryTemplateKey: "RETAIL",
  });
  if (!created.ok) throw new Error(`the business was not created: ${await created.text()}`);
  const listed = await ownerCall("GET", "/me/orgs");
  const body = (await listed.json()) as { data: { organizationId: string; slug: string }[] };
  const found = body.data.find((organization) => organization.slug === SLUG);
  if (found === undefined) throw new Error(`no business with slug ${SLUG}`);
  return found.organizationId;
}

/** The default location the business was created with (offering availability is set there). */
async function defaultLocationId(): Promise<string> {
  const listed = await ownerCall("GET", `/orgs/${organizationId}/locations`);
  if (!listed.ok) throw new Error(`locations could not be listed: ${await listed.text()}`);
  const body = (await listed.json()) as { data: { locationId: string }[] };
  const location = body.data[0];
  if (location === undefined) throw new Error("the business has no location");
  return location.locationId;
}

async function enableCheckout(): Promise<void> {
  const patched = await ownerCall("PATCH", `/orgs/${organizationId}/settings`, {
    items: [{ settingKey: WEBSITE_CHECKOUT_ENABLED_SETTING_KEY, value: true }],
  });
  if (!patched.ok) throw new Error(`checkout was not enabled: ${await patched.text()}`);
}

async function publishProduct(): Promise<void> {
  const created = await ownerCall("POST", `/orgs/${organizationId}/offerings`, {
    kind: "PRODUCT",
    name: PRODUCT_NAME,
    slug: PRODUCT_SLUG,
    price: { amount: PRODUCT_PRICE, currency: BDT },
    unitKey: "PIECE",
  });
  if (!created.ok) throw new Error(`the product was not created: ${await created.text()}`);
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number };
  };
  const published = await ownerCall(
    "POST",
    `/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`,
    { version: offering.data.version },
  );
  if (!published.ok) throw new Error(`the product was not published: ${await published.text()}`);
  const body = (await published.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  const variant = body.data.variants[0];
  if (variant === undefined) throw new Error("the published product has no variant");
  offeringId = body.data.offeringId;
  offeringVersion = body.data.version;
  variantId = variant.variantId;
  const available = await ownerCall(
    "PUT",
    `/orgs/${organizationId}/offerings/${offeringId}/locations/${locationId}`,
    { isAvailable: true },
  );
  if (!available.ok) throw new Error(`availability was not set: ${await available.text()}`);
}

/** A later price for the same variant, so the next submission sees CHECKOUT_PRICE_CHANGED. */
async function raisePrice(): Promise<void> {
  const patched = await ownerCall("PATCH", `/orgs/${organizationId}/offerings/${offeringId}`, {
    version: offeringVersion,
    variants: [{ variantId, price: { amount: RAISED_PRICE, currency: BDT }, unitKey: "PIECE" }],
  });
  if (!patched.ok) throw new Error(`the price was not raised: ${await patched.text()}`);
  const body = (await patched.json()) as { data: { version: number } };
  offeringVersion = body.data.version;
}

async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(`${HOME}${path}`, { waitUntil: "load" });
}

async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => (document.querySelector("main")?.textContent ?? "").includes(wanted),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

async function waitForTextGone(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => !(document.querySelector("main")?.textContent ?? "").includes(wanted),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

/** Waits for a hydrated, enabled button whose text contains `text` (a label may carry an arrow). */
async function waitForEnabledButton(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("button")).some(
        (button) =>
          (button.textContent ?? "").includes(wanted) &&
          !button.disabled &&
          Object.keys(button).some((key) => key.startsWith("__reactProps")),
      ),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

async function clickButton(page: Page, text: string): Promise<void> {
  try {
    await waitForEnabledButton(page, text);
  } catch (error) {
    const body = await page.$eval("main", (main) => (main.textContent ?? "").slice(0, 800));
    throw new Error(`button "${text}" was not ready on ${page.url()}: ${body}`, {
      cause: error,
    });
  }
  await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => (candidate.textContent ?? "").includes(wanted) && !candidate.disabled,
    );
    button?.click();
  }, text);
}

/** Sets a control's value the way a user does: the native setter, then the events React listens to. */
async function setValue(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: DEADLINE_MS });
  await page.$eval(
    selector,
    (element, next) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      nativeSetter?.set?.call(element, next);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    },
    value,
  );
}

async function openOffering(page: Page): Promise<void> {
  await openPage(page, "/offerings");
  const link = `a[href="/offerings/${PRODUCT_SLUG}"]`;
  await page.waitForSelector(link, { timeout: DEADLINE_MS });
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click(link)]);
  await page.waitForSelector("button", { timeout: DEADLINE_MS });
}

async function addToCart(page: Page): Promise<void> {
  await clickButton(page, bnText.addToCart);
  await waitForText(page, bnText.addedToCart);
}

async function proceedToCartQuote(page: Page, expectedTotal: string): Promise<void> {
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('a[href="/cart"]')]);
  // The proceed button is enabled only once the server quote is in hand.
  await waitForEnabledButton(page, bnText.proceed);
  expect(await buttonHeight(page, bnText.proceed)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  const cart = await page.$eval("main", (main) => main.textContent ?? "");
  expect(cart).toContain(expectedTotal);
  await clickButton(page, bnText.proceed);
  try {
    await page.waitForFunction(() => window.location.pathname === "/checkout", {
      timeout: DEADLINE_MS,
      polling: POLL_MS,
    });
  } catch (error) {
    const body = await page.$eval("main", (main) => (main.textContent ?? "").slice(0, 800));
    throw new Error(`the cart did not move to checkout, still on ${page.url()}: ${body}`, {
      cause: error,
    });
  }
  await page.waitForSelector("#checkout-name", { timeout: DEADLINE_MS });
}

async function fillContactAndSubmit(page: Page): Promise<void> {
  // Wait for the hydrated form before typing, so a later hydration does not reset the fields.
  await waitForEnabledButton(page, bnText.placeOrder);
  await setValue(page, "#checkout-name", CUSTOMER_NAME);
  await setValue(page, "#checkout-phone", CUSTOMER_PHONE);
  await clickButton(page, bnText.placeOrder);
}

async function waitForReceipt(page: Page): Promise<void> {
  try {
    await page.waitForFunction(() => window.location.pathname.startsWith("/checkouts/"), {
      timeout: DEADLINE_MS,
      polling: POLL_MS,
    });
  } catch (error) {
    const body = await page.$eval("main", (main) => (main.textContent ?? "").slice(0, 800));
    throw new Error(`no receipt page after submit, still on ${page.url()}: ${body}`, {
      cause: error,
    });
  }
  await waitForText(page, bnText.receiptTitle);
  await waitForText(page, "PLACED");
}

async function buttonHeight(page: Page, text: string): Promise<number> {
  return page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
      (candidate.textContent ?? "").includes(wanted),
    );
    return button?.getBoundingClientRect().height ?? 0;
  }, text);
}

describe("the public storefront commerce flow", () => {
  it("browses, adds to the cart, quotes, checks out and tracks the receipt on a 360px Bangla screen", async () => {
    const context = await stack.browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport(MOBILE_VIEWPORT);
      await openOffering(page);

      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
      expect(await buttonHeight(page, bnText.addToCart)).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET_PX,
      );

      await addToCart(page);
      await proceedToCartQuote(page, "BDT 25.00");

      await fillContactAndSubmit(page);
      await waitForReceipt(page);

      const receipt = await page.$eval("main", (main) => main.textContent ?? "");
      expect(receipt).toContain(CUSTOMER_NAME);
      expect(await page.evaluate(() => window.location.pathname)).toMatch(/^\/checkouts\/.+/);
    } finally {
      await context.close();
    }
  }, 300_000);

  it("re-confirms a changed price before submitting and then places the order", async () => {
    const context = await stack.browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport(DESKTOP_VIEWPORT);
      await openOffering(page);
      await addToCart(page);
      await proceedToCartQuote(page, "BDT 25.00");

      await waitForEnabledButton(page, bnText.placeOrder);
      await setValue(page, "#checkout-name", CUSTOMER_NAME);
      await setValue(page, "#checkout-phone", CUSTOMER_PHONE);
      await raisePrice();

      await clickButton(page, bnText.placeOrder);
      await waitForText(page, bnText.priceChangedTitle);
      expect(await page.evaluate(() => window.location.pathname)).toBe("/checkout");

      await clickButton(page, bnText.acceptPriceChange);
      await waitForTextGone(page, bnText.priceChangedTitle);
      await waitForText(page, "BDT 30.00");

      await clickButton(page, bnText.placeOrder);
      await waitForReceipt(page);
    } finally {
      await context.close();
    }
  }, 300_000);
});
