import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  gotoWhenHydrated,
  message,
  waitForTextIn,
  bodyText,
} from "../test-support/browser-helpers";
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
const SENDER_NAME = "AKMITRADERS";
/** A value that must never appear on the screen once it is saved (write-only secret). */
const STORED_API_KEY = "sms-browser-test-key-7431";

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
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

describe("the SMS settings page", () => {
  it("saves a BulkSMSBD account, shows it as saved without the key, and lists the last sends", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/sms", "#sms-enabled");
    await page.select("#sms-provider", "BULKSMSBD");
    await page.waitForSelector("#sms-bulksmsbd-key");
    await page.type("#sms-bulksmsbd-key", STORED_API_KEY);
    await page.type("#sms-bulksmsbd-sender", SENDER_NAME);
    await clickByName(page, message("sms.settings.save"));
    // The toast, not the page text: the labels also sit in the streamed payload before the save is done.
    await waitForTextIn(page, "[data-sonner-toaster]", message("sms.settings.saved"));
    await gotoWhenHydrated(page, "/acme/settings/sms", "#sms-bulksmsbd-key");
    await waitForTextIn(page, "main", message("sms.logs.empty"));
    const keyBoxValue = await page.$eval(
      "#sms-bulksmsbd-key",
      (input) => (input as HTMLInputElement).value,
    );
    const senderValue = await page.$eval(
      "#sms-bulksmsbd-sender",
      (input) => (input as HTMLInputElement).value,
    );
    const text = await bodyText(page);
    await closePage(page);

    expect(keyBoxValue).toBe("");
    expect(senderValue).toBe(SENDER_NAME);
    expect(text).toContain(message("sms.settings.secret.saved"));
    expect(text).not.toContain(STORED_API_KEY);
  });

  it("lists SMS under Automation on the settings home", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings", "main h2");
    const paths = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main a")).map(
        (link) => (link as HTMLAnchorElement).pathname,
      ),
    );
    await closePage(page);

    expect(paths).toContain("/acme/settings/sms");
  });

  it("stays within the phone width and the script budget", async () => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, "/acme/settings/sms");
    process.stdout.write(
      `initial JS /acme/settings/sms: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
    );
    await gotoWhenHydrated(page, "/acme/settings/sms", "#sms-enabled");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await closePage(page);

    expect(toKiB(size.gzipBytes)).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
