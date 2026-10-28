import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gotoWhenHydrated, message, waitForText } from "../test-support/browser-helpers";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import {
  ADMIN_ORIGIN,
  API_PORT,
  callApi,
  organizationIdOf,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
import { moneyText } from "./report-format";

const BUSINESS_NAME = "রিপোর্ট টেস্ট";
const MINIMUM_TOUCH_TARGET = 43.5;
const DEFAULT_RANGE_DAYS = 7;
const SALE_SLUG = "sale-day";
const BROWSER_SALE = 1_000;
const WORKER_WAIT_MS = 45_000;
const RELOAD_INTERVAL_MS = 1_000;

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রিপোর্ট মালিক");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

function cookieHeader(person: SeededPerson): string {
  return person.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function apiGet<T>(person: SeededPerson, path: string): Promise<T> {
  const response = await fetch(`http://localhost:${API_PORT}/api/v1${path}`, {
    headers: { Cookie: cookieHeader(person), Origin: ADMIN_ORIGIN },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} answered ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function firstLocationId(person: SeededPerson, organizationId: string): Promise<string> {
  const body = await apiGet<{ data: { locationId: string }[] }>(
    person,
    `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
  );
  const location = body.data[0];
  if (location === undefined) throw new Error("the seeded business has no location");
  return location.locationId;
}

async function publishProduct(person: SeededPerson, organizationId: string) {
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: person.cookies,
    body: {
      kind: "PRODUCT",
      name: "Soap",
      kindDetails: { requiresShipping: false },
      variants: [
        { name: "Default", price: { amount: BROWSER_SALE, currency: "BDT" }, unitKey: "PIECE" },
      ],
    },
  });
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: person.cookies,
    body: { version: offering.data.version },
  });
  const variantId = offering.data.variants[0]?.variantId;
  if (variantId === undefined) throw new Error("expected a published variant");
  return { offeringId: offering.data.offeringId, variantId };
}

async function seedPaidSale(person: SeededPerson, slug: string): Promise<void> {
  const organizationId = await organizationIdOf(person, slug);
  const locationId = await firstLocationId(person, organizationId);
  const product = await publishProduct(person, organizationId);
  const sold = await callApi(`/orgs/${organizationId}/orders/instant`, {
    cookies: person.cookies,
    body: {
      locationId,
      lines: [{ offeringId: product.offeringId, variantId: product.variantId, quantity: 1 }],
    },
  });
  const order = (await sold.json()) as { data: { orderId: string } };
  await callApi(`/orgs/${organizationId}/payments`, {
    cookies: person.cookies,
    body: {
      locationId,
      method: "CASH",
      amount: { amount: BROWSER_SALE, currency: "BDT" },
      allocations: [
        {
          requestType: "ORDER",
          requestId: order.data.orderId,
          amount: { amount: BROWSER_SALE, currency: "BDT" },
        },
      ],
    },
  });
}

async function reloadUntilHomeShows(page: Page, path: string, amountText: string): Promise<void> {
  const empty = message("report.home.empty");
  const deadline = Date.now() + WORKER_WAIT_MS;
  while (Date.now() < deadline) {
    await gotoWhenHydrated(page, path, "main");
    const shown = await page.$eval("main", (main) => main.textContent ?? "");
    if (shown.includes(amountText) && !shown.includes(empty)) return;
    await new Promise((resolve) => setTimeout(resolve, RELOAD_INTERVAL_MS));
  }
  const shown = await page.$eval("main", (main) => main.textContent ?? "");
  throw new Error(`home never showed ${amountText}; the page shows: ${shown.slice(0, 600)}`);
}

describe("the business home and the reports page", () => {
  it("shows the empty note on the home of a new business, not a grid of zeros", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme", "main");
    await waitForText(page, message("report.home.empty"));
    await closePage(page);
  }, 180_000);

  it("shows the last 7 days on the reports page, one row per day and the totals", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/reports", "main");
    await waitForText(page, message("report.page.totals"));
    const dayRowCount = await page.$$eval("tbody tr", (rows) => rows.length);
    await closePage(page);

    expect(dayRowCount).toBe(DEFAULT_RANGE_DAYS);
  }, 180_000);

  it("after a paid sale the home shows today's net sales once the worker has counted", async () => {
    const seller = await seedPerson("বিক্রেতা");
    await seedOrganization(seller, SALE_SLUG, "সেল ডে");
    await seedPaidSale(seller, SALE_SLUG);
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, seller);
    const expected = moneyText(BROWSER_SALE, "BDT", "bn");
    await reloadUntilHomeShows(page, `/${SALE_SLUG}`, expected);
    await closePage(page);
  }, 180_000);
});

describe("the phone and the first load of the home and the reports page", () => {
  const routes = [
    ["home", "/acme"],
    ["reports", "/acme/reports"],
  ] as const;

  it.each(routes)("%s stays within the initial JavaScript budget", async (name, path) => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, path);
    process.stdout.write(`initial JS report ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it.each(routes)("%s has no sideways scroll and touch targets of 44 px", async (name, path) => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, path, "main");
    const report = await page.evaluate((minimum) => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const controls = Array.from(
        document.querySelectorAll(
          "main button, main a, main select, main input:not([type=checkbox])",
        ),
      );
      const small = controls
        .filter((control) => control.getClientRects().length > 0)
        .filter((control) => control.getBoundingClientRect().height < minimum)
        .map((control) => `${control.tagName} ${control.textContent?.trim().slice(0, 20)}`);
      return { overflow, small };
    }, MINIMUM_TOUCH_TARGET);
    await closePage(page);

    expect(report.overflow, name).toBeLessThanOrEqual(0);
    expect(report.small, name).toEqual([]);
  });
});
