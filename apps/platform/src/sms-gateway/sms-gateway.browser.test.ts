import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { banglaText } from "../test-support/bangla-text";
import { startBrowserStack, type BrowserStack } from "../test-support/browser-stack";
import {
  DESKTOP_VIEWPORT,
  bodyText,
  closePage,
  gotoHydrated,
  openPage,
  signInAsOperator,
  waitForText,
} from "../test-support/browser-page";

const SENDER_NAME = "PLATFORMSMS";
/** A value that must never appear on the screen once it is saved (write-only secret). */
const STORED_API_KEY = "platform-sms-browser-key-5520";

let stack: BrowserStack;

beforeAll(async () => {
  stack = await startBrowserStack();
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

describe("the platform SMS gateway page", () => {
  it("lets the super admin save the default BulkSMSBD account and shows it as saved without the key", async () => {
    const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await signInAsOperator(page);
    await gotoHydrated(page, "/sms-gateway", "#sms-enabled");
    await page.select("#sms-provider", "BULKSMSBD");
    await page.waitForSelector("#sms-bulksmsbd-key");
    await page.type("#sms-bulksmsbd-key", STORED_API_KEY);
    await page.type("#sms-bulksmsbd-sender", SENDER_NAME);
    await page.click("form button[type=submit]");
    // The toast is visible text; the streamed payload holds the labels as well, so only the visible text counts.
    await waitForText(page, banglaText("platform.sms.saved"));
    await gotoHydrated(page, "/sms-gateway", "#sms-bulksmsbd-key");
    const keyBoxValue = await page.$eval(
      "#sms-bulksmsbd-key",
      (input) => (input as HTMLInputElement).value,
    );
    const text = await bodyText(page);
    await closePage(page);

    expect(keyBoxValue).toBe("");
    expect(text).toContain(banglaText("platform.sms.secret.saved"));
    expect(text).not.toContain(STORED_API_KEY);
  });
});
