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
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const BUSINESS_NAME = "রিপোর্ট টেস্ট";
const MINIMUM_TOUCH_TARGET = 43.5;
const DEFAULT_RANGE_DAYS = 7;

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
