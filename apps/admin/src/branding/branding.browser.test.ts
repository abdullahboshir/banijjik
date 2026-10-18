import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ElementHandle, Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gotoWhenHydrated, message, waitForText } from "../test-support/browser-helpers";
import {
  clickByName,
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

const BUSINESS_NAME = "আকমি ট্রেডার্স";
const TAGLINE = "প্রতিদিন তাজা";
const GREEN_RGB = "rgb(21, 128, 61)";
/** A valid 1x1 PNG, small enough to inline; the API reads the real content, so the bytes must be a real image. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let stack: BrowserStack;
let owner: SeededPerson;
let fixtureFolder: string;
let logoPath: string;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  fixtureFolder = mkdtempSync(join(tmpdir(), "branding-browser-"));
  logoPath = join(fixtureFolder, "logo.png");
  writeFileSync(logoPath, Buffer.from(PNG_BASE64, "base64"));
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

describe("the branding page", () => {
  it("lets the owner upload a logo, pick a preset and save, and then shows the logo in the top bar", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/branding", "#branding-logo");
    const fileInput = await page.waitForSelector("#branding-logo");
    await (fileInput as ElementHandle<HTMLInputElement> | null)?.uploadFile(logoPath);
    await page.waitForSelector("[data-testid=branding-preview] img");
    await clickByName(page, message("branding.preset.green"));
    await page.type("#branding-tagline", TAGLINE);
    const previewColour = await page.$eval(
      "[data-testid=branding-preview-button]",
      (button) => getComputedStyle(button).backgroundColor,
    );
    await clickByName(page, message("branding.save"));
    await waitForText(page, message("branding.saved"));
    await gotoWhenHydrated(page, "/acme/settings/branding", "#branding-tagline");
    const topBarLogo = await page.$eval("header img", (image) => ({
      src: (image as HTMLImageElement).src,
      alt: (image as HTMLImageElement).alt,
    }));
    const savedTagline = await page.$eval(
      "#branding-tagline",
      (input) => (input as HTMLInputElement).value,
    );
    await closePage(page);

    expect(previewColour).toBe(GREEN_RGB);
    expect(topBarLogo.src).toMatch(/\/api\/v1\/public\/files\/[0-9a-f-]+\/thumb$/);
    expect(topBarLogo.alt).toContain(BUSINESS_NAME);
    expect(savedTagline).toBe(TAGLINE);
  });

  it("lists Branding under Business on the settings home", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings", "main h2");
    const paths = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main a")).map(
        (link) => (link as HTMLAnchorElement).pathname,
      ),
    );
    await closePage(page);

    expect(paths).toContain("/acme/settings/branding");
  });

  it("refuses a colour that is too pale for white text before saving, and stays within the phone width and the script budget", async () => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, "/acme/settings/branding");
    process.stdout.write(
      `initial JS /acme/settings/branding: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
    );
    await gotoWhenHydrated(page, "/acme/settings/branding", "#branding-logo");
    await clickByName(page, message("branding.colours.custom"));
    await page.click("#branding-primary", { clickCount: 3 });
    await page.type("#branding-primary", "#ffffff");
    await waitForText(page, message("branding.colours.contrast.low").split("{ratio}")[0] ?? "");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await closePage(page);

    expect(toKiB(size.gzipBytes)).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
