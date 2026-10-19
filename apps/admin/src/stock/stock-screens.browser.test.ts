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
  seedLocation,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

const BUSINESS_NAME = "আকমি ট্রেডার্স";
const SECOND_LOCATION_NAME = "দ্বিতীয় শাখা";
const RICE_ITEM = "চাল";
const ORG_SLUG = `stock-${Date.now().toString(36)}`;

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, ORG_SLUG, BUSINESS_NAME);
  await seedLocation(owner, ORG_SLUG, SECOND_LOCATION_NAME);
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
  await page.waitForSelector(selector, { visible: true });
  await page.type(selector, text);
}

describe("stock at two branches", () => {
  it("receives rice, transfers half to the second branch, and shows both levels and value", async () => {
    const page = await ownerPage();

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock`, "main");
    await clickByName(page, message("stock.item.create"));
    await waitForDialogSettled(page);
    await typeInto(page, "#item-name", RICE_ITEM);
    await page.select("#item-unit", "GRAM");
    await clickByName(page, message("stock.item.createSubmit"));
    await page.waitForSelector("[role=dialog]", { hidden: true });
    await waitForText(page, message("stock.list.empty"));

    await clickByName(page, message("stock.receive.open"));
    await waitForDialogSettled(page);
    await typeInto(page, "#receive-item-0", RICE_ITEM);
    await page.waitForFunction(
      (name) =>
        Array.from(document.querySelectorAll("[role=dialog] button")).some((button) =>
          button.textContent?.includes(name),
        ),
      {},
      RICE_ITEM,
    );
    await page.evaluate((name) => {
      const button = Array.from(document.querySelectorAll("[role=dialog] button")).find((element) =>
        element.textContent?.includes(name),
      );
      (button as HTMLElement | undefined)?.click();
    }, RICE_ITEM);
    await typeInto(page, "#receive-qty-0", "1000");
    await typeInto(page, "#receive-cost-0", "50");
    await clickByName(page, message("stock.receive.submit"));
    await waitForText(page, RICE_ITEM);

    let text = await bodyText(page);
    expect(text).toContain("1000");
    expect(text).toMatch(/50|৳/u);

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/transfers`, "#transfer-from");
    const secondLocationId = await page.$eval(
      "#transfer-to",
      (select, name) => {
        const option = Array.from((select as HTMLSelectElement).options).find(
          (candidate) => candidate.textContent === name,
        );
        return option?.value ?? "";
      },
      SECOND_LOCATION_NAME,
    );
    await page.select("#transfer-to", secondLocationId);
    await typeInto(page, "#transfer-item-0", RICE_ITEM);
    await page.waitForFunction(
      (name) =>
        Array.from(document.querySelectorAll("main button")).some((button) =>
          button.textContent?.includes(name),
        ),
      {},
      RICE_ITEM,
    );
    await page.evaluate((name) => {
      const button = Array.from(document.querySelectorAll("main button")).find((element) =>
        element.textContent?.includes(name),
      );
      (button as HTMLElement | undefined)?.click();
    }, RICE_ITEM);
    await typeInto(page, "#transfer-qty-0", "500");
    await clickByName(page, message("stock.transfers.submit"));
    await waitForText(page, message("stock.transfers.title"));

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock?location=${secondLocationId}`, "main");
    await waitForText(page, RICE_ITEM);
    text = await bodyText(page);
    expect(text).toContain("500");

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock`, "main");
    text = await bodyText(page);
    expect(text).toContain("500");

    await closePage(page);
  });
});
