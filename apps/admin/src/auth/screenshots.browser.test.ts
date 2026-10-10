import { mkdirSync } from "node:fs";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  clickByName,
  closePage,
  DESKTOP_VIEWPORT,
  gotoHydrated,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import {
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

declare global {
  interface ImportMetaEnv {
    /** When set, this test saves its screenshots to this folder; otherwise it is skipped. */
    readonly SCREENSHOT_DIR?: string;
  }
}

const screenshotDir = import.meta.env.SCREENSHOT_DIR;
const SUBMIT_BUTTON = "form button[type=submit]";
const viewports = [
  ["375", PHONE_VIEWPORT],
  ["1280", DESKTOP_VIEWPORT],
] as const;

let stack: BrowserStack;
let person: SeededPerson;

async function saveScreenshot(page: Page, name: string, width: string): Promise<void> {
  await page.screenshot({ path: `${screenshotDir}/${name}-${width}.png`, fullPage: true });
}

beforeAll(async () => {
  if (!screenshotDir) return;
  mkdirSync(screenshotDir, { recursive: true });
  stack = await startBrowserStack();
  person = await seedPerson("রহিম উদ্দিন আহমেদ");
  await seedOrganization(person, "rahim-traders", "রহিম ট্রেডার্স অ্যান্ড সন্স");
  await seedOrganization(person, "karima-fashion", "করিমা ফ্যাশন হাউস");
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

describe.each(viewports)("screenshots at %s px in Bangla", (width, viewport) => {
  it.skipIf(!screenshotDir)("saves the sign-in and sign-up pages", async () => {
    const page = await openPage(stack.browser, viewport);
    await gotoHydrated(page, "/sign-in", SUBMIT_BUTTON);
    await saveScreenshot(page, "sign-in", width);
    await gotoHydrated(page, "/sign-up", SUBMIT_BUTTON);
    await saveScreenshot(page, "sign-up", width);
    await closePage(page);
  });

  it.skipIf(!screenshotDir)("saves the business list and the account menu", async () => {
    const page = await openPage(stack.browser, viewport);
    await signInWithCookies(page, person);
    await gotoHydrated(page, "/", "header button");
    await saveScreenshot(page, "business-list", width);
    await clickByName(page, BUNDLED_CATALOGS.bn["shell.account"] ?? "");
    await waitForDialogSettled(page);
    await saveScreenshot(page, "account-menu", width);
    await closePage(page);
  });
});
