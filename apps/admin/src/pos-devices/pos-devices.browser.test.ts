import type { Page } from "puppeteer-core";
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
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

const ORG_SLUG = "devices-shop";
const BUSINESS_NAME = "ডিভাইস দোকান";
const PAGE_PATH = `/${ORG_SLUG}/settings/pos-devices`;
const DEVICE_NAME = "কাউন্টার ১";
const MINIMUM_TOUCH_TARGET = 43.5;
const CODE_PATTERN = /^\d{8}$/u;
const WAIT_MS = 20_000;
const POLL_MS = 500;

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("ডিভাইস মালিক");
  await seedOrganization(owner, ORG_SLUG, BUSINESS_NAME);
}, 240_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** The usage line as a pattern whose groups are the placeholders, in the order they appear. */
function countedPattern(template: string): { pattern: RegExp; names: string[] } {
  const names = Array.from(template.matchAll(/\{(\w+)\}/gu), (match) => match[1] ?? "");
  const pieces = template.split(/\{\w+\}/u).map(escapeRegex);
  return { pattern: new RegExp(pieces.join("(\\d+)"), "u"), names };
}

/** The number of devices in use, read from the usage line in its limited or unlimited wording. */
function devicesInUse(text: string): number {
  const templates = [message("posDevices.usage"), message("posDevices.usageUnlimited")];
  for (const template of templates) {
    const { pattern, names } = countedPattern(template);
    const match = pattern.exec(text);
    if (match) return Number(match[names.indexOf("used") + 1]);
  }
  throw new Error("the usage line is not on the page");
}

async function waitForDevicesInUse(page: Page, expected: number): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  let lastText = "";
  while (Date.now() < deadline) {
    lastText = await bodyText(page);
    if (devicesInUse(lastText) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`the usage line did not reach ${expected} in time: ${lastText.slice(0, 200)}`);
}

async function addDevice(page: Page): Promise<string> {
  await clickByName(page, message("posDevices.add"));
  await waitForDialogSettled(page);
  await page.waitForSelector("#pos-device-name");
  await page.type("#pos-device-name", DEVICE_NAME);
  await clickByName(page, message("posDevices.form.submit"));
  await page.waitForSelector("#pos-device-code");
  return page.$eval("#pos-device-code", (element) => element.textContent?.trim() ?? "");
}

describe("POS devices settings page", () => {
  it("adds a till, shows its code once, revokes it, and the usage line follows", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, PAGE_PATH, "main");
    await waitForDevicesInUse(page, 0);

    const code = await addDevice(page);
    expect(code).toMatch(CODE_PATTERN);
    await clickByName(page, message("posDevices.code.done"));
    await waitForText(page, DEVICE_NAME);
    await waitForDevicesInUse(page, 1);

    await clickByName(page, message("posDevices.revoke"));
    await clickInDialog(page, message("posDevices.revoke.confirm"));
    await waitForDevicesInUse(page, 0);
    await closePage(page);
  }, 240_000);

  it("has no sideways scroll and touch targets of 44 px on the phone width", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, PAGE_PATH, "main");
    await page.waitForFunction(() => document.querySelector("main p") !== null);
    const report = await page.evaluate((minimum) => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const controls = Array.from(
        document.querySelectorAll("main button, main a, main select, main input"),
      );
      const small = controls
        .filter((control) => control.getClientRects().length > 0)
        .filter((control) => control.getBoundingClientRect().height < minimum)
        .map((control) => `${control.tagName} ${control.textContent?.trim().slice(0, 20)}`);
      return { overflow, small };
    }, MINIMUM_TOUCH_TARGET);
    await closePage(page);

    expect(report.overflow).toBeLessThanOrEqual(0);
    expect(report.small).toEqual([]);
  });
});
