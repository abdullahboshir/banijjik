import { gzipSync } from "node:zlib";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  seedApprovedListing,
  seedBranding,
  seedBusiness,
  seedOwner,
  enableCustomerLogin,
  grantDirectoryModule,
  publishAboutPage,
  publishTemplate,
  signInCustomer,
  type Session,
} from "./test-support/seed";
import {
  API_ORIGIN,
  BASE_DOMAIN,
  STOREFRONT_PORT,
  latestSmsCode,
  startStorefrontStack,
  type StorefrontStack,
} from "./test-support/storefront-stack";

/** 13-UX section 11 and M.6 decision 8: initial JavaScript per route, gzip, in KiB. */
const INITIAL_JS_BUDGET_KIB = 170;
const BYTES_PER_KIB = 1024;
/** `shop` is a reserved organization slug, so the test business uses another one. */
const SLUG = "rahim-bibaho";
const BUSINESS_NAME = "আকমি ট্রেডার্স";
const PHONE_VIEWPORT = { width: 390, height: 844, isMobile: true, hasTouch: true } as const;
const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
const STATS_TIMEOUT_MS = 30_000;
const STATS_POLL_MS = 500;
const PHONE_NUMBER = "+8801712345678";
/** A valid 1x1 PNG: the API reads the real image, so the bytes must be one. */
const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

let stack: StorefrontStack;
let owner: Session;
let organizationId: string;
let listingNumber: string;
/** The signed-in pages (M.6c) are measured with a customer signed in. */
let customerCookie = "";
const SIGNED_IN_PATHS = ["/my/listing", "/my/credits", "/my/connections", "/my/account"];

const HOME = `http://${SLUG}.${BASE_DOMAIN}:${STOREFRONT_PORT}`;

beforeAll(async () => {
  stack = await startStorefrontStack();
  // The template named by test-support/matrimony-business.json.
  await publishTemplate(stack, "MATRIMONY");
  owner = await seedOwner();
  organizationId = await seedBusiness(owner, SLUG, BUSINESS_NAME);
  await grantDirectoryModule(stack, organizationId);
  await seedBranding(owner, organizationId, PNG_BYTES);
  await enableCustomerLogin(owner, organizationId);
  await publishAboutPage(owner, organizationId);
  const customer = await signInCustomer(stack, organizationId);
  customerCookie = customer.cookieHeader;
  listingNumber = (await seedApprovedListing(owner, customer, organizationId)).listingNumber;
  await waitForStatistics();
}, 240_000);

afterAll(async () => {
  await stack?.stop();
});

/** Statistics are refreshed by the worker after the approval; the home page only shows them once counted. */
async function waitForStatistics(): Promise<void> {
  const deadline = Date.now() + STATS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${API_ORIGIN}/api/v1/storefront/orgs/${organizationId}/directory/stats`,
    );
    const body = (await response.json()) as { data: { approvedCount: number } };
    if (body.data.approvedCount >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, STATS_POLL_MS));
  }
  throw new Error("The listing statistics were not refreshed in time");
}

async function openStorefront(
  path: string,
  viewport: typeof DESKTOP_VIEWPORT | typeof PHONE_VIEWPORT,
): Promise<Page> {
  const page = await stack.browser.newPage();
  await page.setViewport(viewport);
  await page.goto(`${HOME}${path}`, { waitUntil: "networkidle0" });
  return page;
}

/** Gzip size of the scripts the HTML of a route references: what the browser loads before the page works. */
async function initialJsKib(path: string, cookieHeader?: string): Promise<number> {
  const response = await fetch(`${HOME}${path}`, {
    headers: cookieHeader === undefined ? {} : { Cookie: cookieHeader },
  });
  const html = await response.text();
  // Legacy polyfills carry `nomodule`: modern browsers never download them (same rule as the admin suite).
  const sources = (html.match(/<script\b[^>]*>/g) ?? [])
    .filter((tag) => !/\snomodule\b/i.test(tag))
    .map((tag) => /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? "")
    .filter((source) => source !== "");
  let total = 0;
  for (const source of new Set(sources)) {
    const script = await fetch(new URL(source, HOME));
    total += gzipSync(Buffer.from(await script.arrayBuffer())).length;
  }
  return total / BYTES_PER_KIB;
}

describe("the public storefront", () => {
  it("shows the home page with the logo, the colours and the statistics", async () => {
    const page = await openStorefront("/", DESKTOP_VIEWPORT);
    const logoCount = await page.$$eval(`img[alt="${BUSINESS_NAME}"]`, (images) => images.length);
    const brandColour = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--color-brand-primary").trim(),
    );
    const hasStatistics = await page.$("#home-stats-title");
    await page.close();
    expect(logoCount).toBeGreaterThan(0);
    // The API stores colours in lower case.
    expect(brandColour).toBe("#1f6f5c");
    expect(hasStatistics).not.toBeNull();
  });

  it("filters the search results and shows the empty state when nothing matches", async () => {
    const page = await openStorefront("/search", DESKTOP_VIEWPORT);
    const resultCount = await page.$$eval('a[href^="/listings/"]', (links) => links.length);
    await page.close();
    const emptyPage = await openStorefront("/search?f.gender=no-such-option", DESKTOP_VIEWPORT);
    const emptyText = await emptyPage.$eval("main", (main) => main.textContent ?? "");
    await emptyPage.close();
    expect(resultCount).toBeGreaterThan(0);
    expect(emptyText).toContain("এই ফিল্টারে কোনো প্রোফাইল মেলেনি।");
  });

  it("shows a listing page with its details and a sign-in call to action when signed out", async () => {
    const page = await openStorefront(`/listings/${listingNumber}`, DESKTOP_VIEWPORT);
    const text = await page.$eval("main", (main) => main.textContent ?? "");
    const hasSignInLink = await page.$(`a[href^="/sign-in?next="]`);
    await page.close();
    expect(text).toContain(listingNumber);
    expect(hasSignInLink).not.toBeNull();
  });

  it("signs a customer in with the test-inbox code, sets the cookies and shows the account in the header", async () => {
    const page = await openStorefront("/sign-in", DESKTOP_VIEWPORT);
    await page.type("#sign-in-phone", PHONE_NUMBER);
    const sentAfter = new Date();
    await clickSubmit(page);
    await page.waitForSelector("#sign-in-code");
    const code = await latestSmsCode(stack, PHONE_NUMBER, sentAfter);
    await page.type("#sign-in-code", code);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), clickSubmit(page)]);
    const cookieNames = (await page.cookies()).map((cookie) => cookie.name);
    const headerText = await page.$eval("header", (header) => header.textContent ?? "");
    await page.close();
    expect(cookieNames).toEqual(expect.arrayContaining(["sf_access"]));
    expect(headerText).toContain(PHONE_NUMBER);
  });

  it("shows a published static page", async () => {
    const page = await openStorefront("/pages/about", DESKTOP_VIEWPORT);
    const heading = await page.$eval("h1", (node) => node.textContent ?? "");
    await page.close();
    expect(heading).toBe("আমাদের সম্পর্কে");
  });

  it("answers an unknown host with 404 and the site-not-found text", async () => {
    const response = await fetch(`http://nobody.${BASE_DOMAIN}:${STOREFRONT_PORT}/`);
    const body = await response.text();
    expect(response.status).toBe(404);
    expect(body).toContain("এই সাইটটি নেই।");
  });

  it("keeps the initial JavaScript of each route within the budget", async () => {
    const publicPaths = ["/", "/search", `/listings/${listingNumber}`, "/sign-in"];
    const publicSizes = await Promise.all(publicPaths.map((path) => initialJsKib(path)));
    const signedInSizes = await Promise.all(
      SIGNED_IN_PATHS.map((path) => initialJsKib(path, customerCookie)),
    );
    const routes = [...publicPaths, ...SIGNED_IN_PATHS];
    const sizes = [...publicSizes, ...signedInSizes];
    process.stdout.write(
      routes
        .map(
          (path, index) => `initial JS ${path}: ${sizes[index]?.toFixed(1)} KiB gzip
`,
        )
        .join(""),
    );
    routes.forEach((path, index) => {
      expect(sizes[index] ?? Number.POSITIVE_INFINITY, path).toBeLessThanOrEqual(
        INITIAL_JS_BUDGET_KIB,
      );
    });
  });

  it("has no sideways scroll on a phone", async () => {
    for (const path of ["/", "/search", `/listings/${listingNumber}`]) {
      const page = await openStorefront(path, PHONE_VIEWPORT);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      await page.close();
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});

async function clickSubmit(page: Page): Promise<void> {
  await page.click('button[type="submit"]');
}
