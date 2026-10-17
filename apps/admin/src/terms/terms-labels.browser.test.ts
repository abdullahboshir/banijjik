import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForText,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  DESKTOP_VIEWPORT,
  openPage,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import {
  ADMIN_ORIGIN,
  seedLocation,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

const BUSINESS_NAME = "আকমি ট্রেডার্স";
const TEMPLATE_TERM_BN = "শাখা";
const OUTLET_BN = "আউটলেট";
const OUTLET_EN = "Outlet";
const LOCATIONS_LINK = 'a[href="/acme/settings/locations"]';

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  await seedLocation(owner, "acme", "দ্বিতীয় দোকান");
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

async function useLanguage(page: Page, locale: "bn" | "en"): Promise<void> {
  await page.setCookie({
    name: "locale",
    value: locale,
    domain: new URL(ADMIN_ORIGIN).hostname,
    path: "/",
  });
}

async function menuLabel(page: Page): Promise<string> {
  await page.waitForSelector(LOCATIONS_LINK);
  return page.$eval(LOCATIONS_LINK, (link) => link.textContent?.trim() ?? "");
}

async function pageTitle(page: Page): Promise<string> {
  return page.$eval("main h1", (heading) => heading.textContent?.trim() ?? "");
}

/** Clicks Change on the term row whose text contains the label. */
async function openTermSheet(page: Page, rowText: string): Promise<void> {
  await page.waitForFunction(
    (row, label) => {
      const rows = Array.from(document.querySelectorAll("main li, main tr")).filter((candidate) =>
        candidate.textContent?.includes(row),
      );
      const button = rows
        .flatMap((candidate) => Array.from(candidate.querySelectorAll("button")))
        .find(
          (candidate) =>
            candidate.textContent?.trim() === label && candidate.getClientRects().length > 0,
        );
      button?.setAttribute("data-row-target", "true");
      return button !== undefined;
    },
    {},
    rowText,
    message("terms.change"),
  );
  await page.click("[data-row-target]");
  await page.evaluate(() =>
    document.querySelector("[data-row-target]")?.removeAttribute("data-row-target"),
  );
  await waitForDialogSettled(page);
}

describe("a renamed term shows where it is used", () => {
  it("starts with the template's word in the menu and on the locations page", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/locations", "main button");
    const menu = await menuLabel(page);
    const title = await pageTitle(page);
    await closePage(page);

    expect(menu).toBe(TEMPLATE_TERM_BN);
    expect(title).toBe(TEMPLATE_TERM_BN);
  });

  it("shows the new word in Bangla, then in English, after the owner renames the term", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/terms", "main button");
    await openTermSheet(page, message("terms.key.location"));
    await page.click("#term-bn", { clickCount: 3 });
    await page.type("#term-bn", OUTLET_BN);
    await page.click("#term-en", { clickCount: 3 });
    await page.type("#term-en", OUTLET_EN);
    await clickByName(page, message("common.save"));
    await page.waitForSelector("[role=dialog]", { hidden: true });

    await gotoWhenHydrated(page, "/acme/settings/locations", "main button");
    const menuBn = await menuLabel(page);
    const titleBn = await pageTitle(page);
    await waitForText(page, message("locations.add").replace("{term}", OUTLET_BN));
    await useLanguage(page, "en");
    await gotoWhenHydrated(page, "/acme/settings/locations", "main button");
    const menuEn = await menuLabel(page);
    const titleEn = await pageTitle(page);
    await closePage(page);

    expect(menuBn).toBe(OUTLET_BN);
    expect(titleBn).toBe(OUTLET_BN);
    expect(menuEn).toBe(OUTLET_EN);
    expect(titleEn).toBe(OUTLET_EN);
  });

  it("brings the template's word back after the owner resets the term", async () => {
    const page = await ownerPage();
    await useLanguage(page, "bn");
    await gotoWhenHydrated(page, "/acme/settings/terms", "main button");
    await openTermSheet(page, message("terms.key.location"));
    await clickInDialog(page, message("terms.reset"));
    await page.waitForSelector("[role=dialog]", { hidden: true });

    await gotoWhenHydrated(page, "/acme/settings/locations", "main button");
    const menu = await menuLabel(page);
    const title = await pageTitle(page);
    await closePage(page);

    expect(menu).toBe(TEMPLATE_TERM_BN);
    expect(title).toBe(TEMPLATE_TERM_BN);
  });
});
