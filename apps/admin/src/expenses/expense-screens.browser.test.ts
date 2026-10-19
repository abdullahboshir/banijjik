import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ElementHandle, Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForText,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import {
  seedLocation,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const BUSINESS_NAME = "খরচ টেস্ট";
const CATEGORY_BN = "অফিস ভাড়া";
const CATEGORY_EN = "Office rent";
const VOID_REASON = "ভুল এন্ট্রি";
const MINIMUM_TOUCH_TARGET = 43.5;
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DETAIL_PATH = /^\/acme\/expenses\/[0-9a-f-]{36}$/u;

let stack: BrowserStack;
let owner: SeededPerson;
let fixtureFolder: string;
let imagePath: string;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("খরচ মালিক");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  await seedLocation(owner, "acme", "দ্বিতীয় শাখা");
  fixtureFolder = mkdtempSync(join(tmpdir(), "expense-browser-"));
  imagePath = join(fixtureFolder, "receipt.png");
  writeFileSync(imagePath, Buffer.from(PNG_BASE64, "base64"));
}, 120_000);

afterAll(async () => {
  await stack?.stop();
  if (fixtureFolder !== undefined) {
    rmSync(fixtureFolder, { recursive: true, force: true });
  }
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

describe("expense screens", () => {
  it("adds a category, records an expense with a photo, voids it, and the trial balance still balances", async () => {
    const page = await ownerPage();

    await gotoWhenHydrated(page, "/acme/expenses/categories", "#new-expense-category-bn");
    await typeInto(page, "#new-expense-category-bn", CATEGORY_BN);
    await typeInto(page, "#new-expense-category-en", CATEGORY_EN);
    await clickByName(page, message("expenses.categories.add"));
    await waitForText(page, CATEGORY_BN);

    await gotoWhenHydrated(page, "/acme/expenses", "main");
    await clickByName(page, message("expenses.add"));
    await waitForDialogSettled(page);
    await page.waitForSelector("#expense-amount");
    await typeInto(page, "#expense-amount", "250");
    await page.select(
      "#expense-category",
      await page.$eval(
        "#expense-category",
        (select, categoryName) => {
          const option = Array.from((select as HTMLSelectElement).options).find(
            (candidate) => candidate.textContent === categoryName,
          );
          return option?.value ?? "";
        },
        CATEGORY_BN,
      ),
    );
    const fileInput = await page.waitForSelector("#expense-attachment-new");
    await (fileInput as ElementHandle<HTMLInputElement> | null)?.uploadFile(imagePath);
    await page.waitForSelector(`img[alt="${message("expenses.form.attachments")}"]`);
    await clickInDialog(page, message("expenses.form.save"));
    // Sheet closes and the list refreshes; phone cards show number, amount and category.
    await page.waitForFunction(() => document.querySelector("#expense-amount") === null);
    await page.waitForFunction(
      (category) =>
        Array.from(document.querySelectorAll("main ul button")).some((button) =>
          button.textContent?.includes(category),
        ),
      {},
      CATEGORY_BN,
    );
    await page.evaluate((category) => {
      const button = Array.from(document.querySelectorAll("main ul button")).find((element) =>
        element.textContent?.includes(category),
      );
      (button as HTMLElement | undefined)?.click();
    }, CATEGORY_BN);
    await page.waitForFunction(
      (pattern) => new RegExp(pattern, "u").test(window.location.pathname),
      {},
      DETAIL_PATH.source,
    );

    await clickByName(page, message("expenses.detail.void"));
    await waitForDialogSettled(page);
    await page.waitForSelector("#expense-void-reason");
    await typeInto(page, "#expense-void-reason", VOID_REASON);
    await clickInDialog(page, message("expenses.void.confirm"));
    await waitForText(page, message("expenses.status.VOIDED"));

    await gotoWhenHydrated(page, "/acme/settings/trial-balance", "#trial-balance-as-of");
    await waitForText(page, message("trialBalance.balancesYes"));
    const text = await bodyText(page);
    await closePage(page);

    expect(text).toContain(message("trialBalance.balancesYes"));
  }, 180_000);
});

describe("the phone and the first load", () => {
  const routes = [
    ["list", "/acme/expenses"],
    ["categories", "/acme/expenses/categories"],
    ["trial-balance", "/acme/settings/trial-balance"],
  ] as const;

  it.each(routes)("%s stays within the initial JavaScript budget", async (name, path) => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, path);
    process.stdout.write(`initial JS expense ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it.each(routes)("%s has no sideways scroll and touch targets of 44 px", async (name, path) => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, path, "main");
    await page.waitForFunction(() => document.querySelector("main form, main ul, main p") !== null);
    const report = await page.evaluate((minimum) => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const controls = Array.from(
        document.querySelectorAll(
          "main button, main a, main select, main input:not([type=file]):not([type=checkbox]), main textarea",
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
