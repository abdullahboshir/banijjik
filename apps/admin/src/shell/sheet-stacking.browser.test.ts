import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_ORIGIN,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";

const PAGE_URL = `${ADMIN_ORIGIN}/test-org`;
const labels = BUNDLED_CATALOGS.bn;

let stack: BrowserStack;
let person: SeededPerson;

async function openSheet(page: Page, triggerLabel: string): Promise<void> {
  await page.goto(PAGE_URL, { waitUntil: "networkidle0" });
  // Every bottom-nav button must be hydrated before one is clicked.
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("nav button")).every((button) =>
      Object.keys(button).some((key) => key.startsWith("__reactProps")),
    ),
  );
  await page.evaluate((text) => {
    const buttons = Array.from(document.querySelectorAll("nav button"));
    buttons
      .find(
        (button) =>
          button.textContent?.includes(text) || button.getAttribute("aria-label") === text,
      )
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, triggerLabel);
  await waitForDialogSettled(page);
}

/** Whether the element on top at the given point of the open dialog is part of the dialog. */
async function isDialogOnTop(page: Page, closeLabel: string): Promise<boolean[]> {
  return page.evaluate((closeText) => {
    const dialog = document.querySelector("[role=dialog]");
    const closeButton = dialog?.querySelector(`[aria-label="${closeText}"]`);
    if (!dialog || !closeButton) return [false, false];
    const topAt = (element: Element): Element | null => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    };
    const centreTop = topAt(dialog);
    const closeTop = topAt(closeButton);
    return [dialog.contains(centreTop), dialog.contains(closeTop)];
  }, closeLabel);
}

beforeAll(async () => {
  stack = await startBrowserStack();
  person = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(person, "test-org", "টেস্ট অর্গ");
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

describe("sheet stacking at 375 px (review J3)", () => {
  it.each([
    ["Quick create", labels["nav.quickCreate"]],
    ["More", labels["nav.more"]],
  ])("%s sheet is on top at its centre and at its close button", async (_name, triggerLabel) => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    await openSheet(page, triggerLabel ?? "");
    const [centreIsDialog, closeIsDialog] = await isDialogOnTop(
      page,
      labels["shell.closeMenu"] ?? "",
    );
    await closePage(page);
    expect({ centreIsDialog, closeIsDialog }).toEqual({
      centreIsDialog: true,
      closeIsDialog: true,
    });
  });

  it("gives the two navigation landmarks different labels", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    await page.goto(PAGE_URL, { waitUntil: "networkidle0" });
    const names = await page.$$eval("nav[aria-label]", (navs) =>
      navs.map((nav) => nav.getAttribute("aria-label")),
    );
    await closePage(page);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain(labels["nav.bottom"]);
  });
});
