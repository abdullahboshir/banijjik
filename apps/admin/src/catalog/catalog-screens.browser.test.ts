import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ElementHandle, Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  gotoWhenHydrated,
  message,
  waitForBadge,
  waitForText,
} from "../test-support/browser-helpers";
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
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import salonFixture from "../test-support/salon-industry-fixture.json" with { type: "json" };
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const BUSINESS_NAME = "আকমি ট্রেডার্স";
const SECOND_LOCATION_NAME = "দ্বিতীয় শাখা";
/** The retail template's own word for a product (card 2.8); it is the title of the list and the add button. */
const TEMPLATE_WORD = "পণ্য";
const SHIRT_NAME = "টি-শার্ট";
const RICE_NAME = "চাল";
const MINIMUM_TOUCH_TARGET = 43.5;
/** A valid 1x1 PNG; the API reads the real content, so the bytes must be a real image. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DETAIL_PATH = /^\/acme\/catalog\/[0-9a-f-]{36}$/u;

let stack: BrowserStack;
let owner: SeededPerson;
let fixtureFolder: string;
let imagePath: string;
const savedPaths: Record<string, string> = {};

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  await seedLocation(owner, "acme", SECOND_LOCATION_NAME);
  fixtureFolder = mkdtempSync(join(tmpdir(), "catalog-browser-"));
  imagePath = join(fixtureFolder, "shirt.png");
  writeFileSync(imagePath, Buffer.from(PNG_BASE64, "base64"));
}, 120_000);

afterAll(async () => {
  await stack?.stop();
  rmSync(fixtureFolder, { recursive: true, force: true });
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

/** Clicks a checkbox by the exact text of its label. */
async function tick(page: Page, label: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => {
      const found = Array.from(document.querySelectorAll("main label")).find(
        (element) => element.textContent?.trim() === wanted,
      );
      found?.setAttribute("data-tick-target", "true");
      return found !== undefined;
    },
    {},
    label,
  );
  await page.click("[data-tick-target]");
  await page.evaluate(() =>
    document.querySelector("[data-tick-target]")?.removeAttribute("data-tick-target"),
  );
}

async function waitForDetailPath(page: Page): Promise<string> {
  await page.waitForFunction(
    (pattern) => new RegExp(pattern, "u").test(window.location.pathname),
    {},
    DETAIL_PATH.source,
  );
  return new URL(page.url()).pathname;
}

/** Opens the add form from the list through the business's own button (single kind: no kind cards). */
async function openNewProduct(page: Page): Promise<void> {
  await gotoWhenHydrated(page, "/acme/catalog", "main a");
  await clickByName(page, message("catalog.list.add").replace("{kind}", TEMPLATE_WORD));
  await page.waitForSelector("#offering-name");
}

describe("the catalog list in the words of the template", () => {
  it("is titled and labelled in the retail words, empty at first", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/catalog", "main a");
    const title = await page.$eval("h1", (heading) => heading.textContent ?? "");
    const text = await bodyText(page);
    await closePage(page);

    expect(title).toBe(TEMPLATE_WORD);
    expect(text).toContain(message("catalog.list.empty").replace("{kind}", TEMPLATE_WORD));
    expect(text).toContain(message("catalog.list.addFirst").replace("{kind}", TEMPLATE_WORD));
  });
});

describe("adding products", () => {
  it("adds a product with two sizes and SKUs and a photo, publishes it, and finds it by SKU", async () => {
    const page = await ownerPage();
    await openNewProduct(page);
    await typeInto(page, "#offering-name", SHIRT_NAME);
    const fileInput = await page.waitForSelector("#offering-image");
    await (fileInput as ElementHandle<HTMLInputElement> | null)?.uploadFile(imagePath);
    await page.waitForSelector(`img[alt="${message("catalog.image.alt")}"]`);
    await tick(page, message("catalog.options.toggle"));
    await typeInto(page, "#option-0-name", "সাইজ");
    for (const size of ["M", "L"]) {
      await typeInto(page, "#option-0-value", size);
      await clickByName(page, message("catalog.options.addValue"));
      await page.waitForFunction(
        (id) => (document.querySelector<HTMLInputElement>(id)?.value ?? "x") === "",
        {},
        "#option-0-value",
      );
    }
    await typeInto(page, "#variant-0-price", "450");
    await typeInto(page, "#variant-0-sku", "TS-M");
    await typeInto(page, "#variant-1-price", "450");
    await typeInto(page, "#variant-1-sku", "TS-L");
    await clickByName(page, message("catalog.editor.saveAndPublish"));
    savedPaths["shirt"] = await waitForDetailPath(page);
    await waitForBadge(page, message("catalog.status.ACTIVE"));
    await gotoWhenHydrated(page, "/acme/catalog?q=TS-L", "main a");
    await waitForText(page, SHIRT_NAME);
    const listText = await bodyText(page);
    await closePage(page);

    expect(listText).toContain(message("catalog.optionsCount").replace("{count}", "2"));
  });

  it("adds loose rice in kilograms sold from 250 grams in steps of 250, and keeps the rule", async () => {
    const page = await ownerPage();
    await openNewProduct(page);
    await typeInto(page, "#offering-name", RICE_NAME);
    await page.select("#offering-unit", "KG");
    await tick(page, message("catalog.loose.toggle"));
    await typeInto(page, "#offering-price", "80");
    await typeInto(page, "#loose-min", "250");
    await typeInto(page, "#loose-step", "250");
    await clickByName(page, message("catalog.editor.saveDraft"));
    savedPaths["rice"] = await waitForDetailPath(page);
    await gotoWhenHydrated(page, savedPaths["rice"], "#loose-min");
    const rule = await page.$$eval("#loose-min, #loose-step", (inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
    const unit = await page.$eval(
      "#offering-unit",
      (select) => (select as HTMLSelectElement).value,
    );
    await closePage(page);

    expect(rule).toEqual(["250", "250"]);
    expect(unit).toBe("KG");
  });

  it("gives a second branch its own price for the rice, shown on the list for that branch", async () => {
    const page = await ownerPage();
    const ricePath = savedPaths["rice"] ?? "";
    await gotoWhenHydrated(page, ricePath, "#branch-location");
    const secondLocationId = await page.$eval(
      "#branch-location",
      (select, name) => {
        const option = Array.from((select as HTMLSelectElement).options).find(
          (candidate) => candidate.textContent === name,
        );
        return option?.value ?? "";
      },
      SECOND_LOCATION_NAME,
    );
    await page.select("#branch-location", secondLocationId);
    await page.waitForSelector("input[id^=branch-price-]");
    await page.type("input[id^=branch-price-]", "90");
    await clickByName(page, message("catalog.branches.save"));
    await waitForText(page, message("catalog.branches.saved"));
    await gotoWhenHydrated(page, `/acme/catalog?location=${secondLocationId}`, "main a");
    await waitForText(page, RICE_NAME);
    const row = await page.$$eval("main li", (items) =>
      items.map((item) => (item as HTMLElement).innerText).find((text) => text.includes("চাল")),
    );
    await closePage(page);

    expect(row).toContain("90");
  });
});

describe("categories and add-ons", () => {
  it("adds a category and an add-on group", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/catalog/categories", "#new-category-name");
    await page.type("#new-category-name", "পোশাক");
    await clickByName(page, message("catalog.categories.add"));
    await waitForText(page, "পোশাক");
    await gotoWhenHydrated(page, "/acme/catalog/add-ons", "main button");
    await clickByName(page, message("catalog.addOns.add"));
    await typeInto(page, "#add-on-name", "টপিং");
    await typeInto(page, "#add-on-option-0", "চিজ");
    await typeInto(page, "#add-on-price-0", "20");
    await clickByName(page, message("catalog.addOns.save"));
    await waitForText(page, message("catalog.addOns.optionsCount").replace("{count}", "1"));
    await closePage(page);
  });
});

describe("the phone and the first load", () => {
  const routes = [
    ["list", () => "/acme/catalog"],
    ["new", () => "/acme/catalog/new?kind=PRODUCT"],
    ["detail", () => savedPaths["shirt"] ?? ""],
    ["categories", () => "/acme/catalog/categories"],
    ["add-ons", () => "/acme/catalog/add-ons"],
  ] as const;

  it.each(routes)("%s stays within the initial JavaScript budget", async (name, path) => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, path());
    process.stdout.write(`initial JS catalog ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it.each(routes)("%s has no sideways scroll and touch targets of 44 px", async (name, path) => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, path(), "main");
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

describe("the SALON catalog", () => {
  it("lets the owner add a bookable service offering", async () => {
    const owner = await seedPerson("সালমা");
    await seedOrganizationWithBody(owner, {
      name: "সালমা পার্লার",
      slug: "salon",
      ...salonFixture,
    });
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    await gotoWhenHydrated(page, "/salon/catalog/new?kind=SERVICE", "#offering-name");
    await typeInto(page, "#offering-name", "হেয়ারকাট");
    await page.type("#detail-durationMinutes", "30");
    await clickByName(page, message("catalog.editor.saveDraft"));
    await waitForText(page, "হেয়ারকাট");
    await closePage(page);
  });
});
