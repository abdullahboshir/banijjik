import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyText, gotoWhenHydrated, message, waitForText } from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import {
  seedLocation,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

const BUSINESS_NAME = "প্রাইস ট্রেডার্স";
const CATEGORY_NAME = "চাল";
const OFFERING_NAME = "Loose rice";

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("করিম উদ্দিন");
  await seedOrganization(owner, "price-shop", BUSINESS_NAME);
  await seedLocation(owner, "price-shop", "মূল শাখা");
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

describe("promotions screen", () => {
  it("creates a 10% category promotion and shows it in the quote preview", async () => {
    const page = await ownerPage();

    await gotoWhenHydrated(page, "/price-shop/catalog/categories", "#new-category-name");
    await typeInto(page, "#new-category-name", CATEGORY_NAME);
    await clickByName(page, message("catalog.categories.add"));
    await waitForText(page, CATEGORY_NAME);

    await gotoWhenHydrated(page, "/price-shop/catalog/new?kind=PRODUCT", "#offering-name");
    await typeInto(page, "#offering-name", OFFERING_NAME);
    await typeInto(page, "#offering-price", "100");
    await page.waitForFunction(
      (name) =>
        Array.from(document.querySelectorAll("main label")).some(
          (label) => label.textContent?.trim() === name,
        ),
      {},
      CATEGORY_NAME,
    );
    await page.evaluate((name) => {
      const label = Array.from(document.querySelectorAll("main label")).find(
        (item) => item.textContent?.trim() === name,
      );
      (label?.querySelector("input[type=checkbox]") as HTMLInputElement | null)?.click();
    }, CATEGORY_NAME);
    await clickByName(page, message("catalog.editor.saveAndPublish"));
    await page.waitForFunction(
      () => /\/price-shop\/catalog\/[0-9a-f-]{36}$/u.test(window.location.pathname),
      { timeout: 30_000 },
    );

    await gotoWhenHydrated(page, "/price-shop/catalog/promotions", "#new-promotion-name");
    await typeInto(page, "#new-promotion-name", "Ten percent rice");
    await page.select("#new-promotion-target", "CATEGORY");
    await clickByName(page, message("pricing.promotions.save"));
    await waitForText(page, "Ten percent rice");
    await clickByName(page, message("pricing.promotions.activate"));
    await waitForText(page, message("pricing.promotions.status.ACTIVE"));

    await clickByName(page, message("pricing.promotions.preview.run"));
    await page.waitForFunction(
      (discountLabel) => document.body.innerText.includes(discountLabel),
      {},
      message("pricing.promotions.preview.discount"),
    );
    const text = await bodyText(page);
    await closePage(page);

    expect(text).toContain(message("pricing.promotions.preview.discount"));
    expect(text).toMatch(/1000|১০০০/);
  }, 120_000);
});
