import { mkdirSync } from "node:fs";
import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clickByName,
  closePage,
  DESKTOP_VIEWPORT,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
  waitForHydration,
} from "../test-support/browser-page";
import {
  ADMIN_ORIGIN,
  seedOrganization,
  seedPerson,
  setTrialEndsInDays,
  startBrowserStack,
  TEST_PASSWORD,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

declare global {
  interface ImportMetaEnv {
    /** When set, the screenshot tests save their pictures to this folder; otherwise they are skipped. */
    readonly SCREENSHOT_DIR?: string;
  }
}

const screenshotDir = import.meta.env.SCREENSHOT_DIR;
const API_ORIGIN = "http://localhost:4000";
const SUBMIT_BUTTON = "form button[type=submit]";
const BUSINESS_NAME = "আকমি ট্রেডার্স";
const INVITEE_NAME = "করিম হোসেন";

function message(messageKey: string): string {
  const found = BUNDLED_CATALOGS.bn[messageKey] ?? SCREEN_CATALOGS.bn[messageKey];
  if (found === undefined) throw new Error(`Missing Bangla message ${messageKey}`);
  return found;
}

let stack: BrowserStack;
let owner: SeededPerson;
let inviteeEmail: string;
let memberDetailPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  inviteeEmail = `karim-${Date.now()}@example.com`;
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

/**
 * Like gotoHydrated, but does not wait for the network to go quiet: at desktop width the sidebar links are
 * in view and Next keeps prefetching them, so the network never rests for 500 ms.
 */
async function gotoWhenHydrated(page: Page, path: string, selector: string): Promise<void> {
  await page.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page, selector);
}

async function waitForPath(page: Page, path: string): Promise<void> {
  await page.waitForFunction((expected) => window.location.pathname === expected, {}, path);
}

async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => document.body.textContent?.includes(wanted) ?? false,
    {},
    text,
  );
}

/** Waits for a status badge with exactly this text (a button label may contain the same words). */
async function waitForBadge(page: Page, label: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("[data-tone]")).some(
        (badge) => badge.textContent === wanted,
      ),
    {},
    label,
  );
}

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.textContent ?? "");
}

/** Clicks the first visible button of the selector whose text passes the check. */
async function clickButton(
  page: Page,
  selector: string,
  matches: (text: string) => boolean,
): Promise<void> {
  await page.waitForFunction((css) => document.querySelector(css) !== null, {}, selector);
  for (const button of await page.$$(selector)) {
    const text = (await button.evaluate((element) => element.textContent ?? "")).trim();
    const isVisible = await button.evaluate((element) => element.getClientRects().length > 0);
    if (isVisible && matches(text)) {
      await button.click();
      return;
    }
  }
  throw new Error(`No button in ${selector} matched`);
}

/** Clicks a button inside the open dialog or sheet (the same label may also be on the page behind it). */
async function clickInDialog(page: Page, name: string): Promise<void> {
  await waitForDialogSettled(page);
  await clickButton(page, "[role=dialog] button", (text) => text === name);
}

/** Clicks the first visible list button whose text contains the given text (a card holds several texts). */
async function clickButtonContaining(page: Page, text: string): Promise<void> {
  await clickButton(page, "main button", (buttonText) => buttonText.includes(text));
}

/** Opens the invitation sheet, creates an invitation for the email and returns the one-time link. */
async function createInvitationThroughUi(
  page: Page,
  identifier: string,
  displayName: string,
): Promise<string> {
  await gotoWhenHydrated(page, "/acme/settings/staff/invitations", "main button");
  await clickByName(page, message("invitations.create"));
  await waitForDialogSettled(page);
  await page.type("#invite-identifier", identifier);
  await page.type("#invite-name", displayName);
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>("#invite-role-0");
    const manager = Array.from(select?.options ?? []).find(
      (option) => option.textContent === "ম্যানেজার",
    );
    if (select && manager) {
      select.value = manager.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
  await page.waitForSelector("#invite-link");
  return page.$eval("#invite-link", (input) => (input as HTMLInputElement).value);
}

async function signUpAsInvitee(page: Page, link: string): Promise<void> {
  await page.goto(link, { waitUntil: "networkidle0" });
  await clickByName(page, message("auth.signUp.submit"));
  await waitForPath(page, "/sign-up");
  await page.waitForSelector("#name");
  await page.type("#name", INVITEE_NAME);
  await page.type("#identifier", inviteeEmail);
  await page.type("#password", TEST_PASSWORD);
  await page.click(SUBMIT_BUTTON);
}

describe("invite, accept, then suspend and reactivate", () => {
  it("lets the owner invite a person who signs up, accepts and lands in the business", async () => {
    const ownerPage = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(ownerPage, owner);
    const link = await createInvitationThroughUi(ownerPage, inviteeEmail, INVITEE_NAME);
    const shownHint = await bodyText(ownerPage);
    await closePage(ownerPage);
    expect(link.startsWith(`${ADMIN_ORIGIN}/invitations/`)).toBe(true);
    expect(shownHint).toContain(message("invite.link.hint"));

    const inviteePage = await openPage(stack.browser, PHONE_VIEWPORT);
    await signUpAsInvitee(inviteePage, link);
    await waitForPath(inviteePage, new URL(link).pathname);
    await waitForText(inviteePage, message("accept.submit"));
    await clickByName(inviteePage, message("accept.submit"));
    await waitForPath(inviteePage, "/acme");
    await waitForText(inviteePage, BUSINESS_NAME);
    const roleKeys = await inviteePage.evaluate(async (api) => {
      const response = await fetch(`${api}/api/v1/me/orgs`, { credentials: "include" });
      const body = (await response.json()) as { data: { roleKeys: string[] }[] };
      return body.data.flatMap((organization) => organization.roleKeys);
    }, API_ORIGIN);
    await closePage(inviteePage);
    expect(roleKeys).toEqual(["MANAGER"]);
  });

  it("shows the new member in the owner's staff list and opens the detail", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    await gotoWhenHydrated(page, "/acme/settings/staff", "main button");
    await waitForText(page, INVITEE_NAME);
    await clickButtonContaining(page, INVITEE_NAME);
    await page.waitForFunction(() => /\/settings\/staff\/[0-9a-f-]{36}$/.test(location.pathname));
    memberDetailPath = await page.evaluate(() => window.location.pathname);
    await waitForText(page, message("staff.action.suspend"));
    await closePage(page);
    expect(memberDetailPath).toContain("/acme/settings/staff/");
  });

  it("answers the not-found page to a suspended member and lets them back in after reactivation", async () => {
    const ownerPage = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(ownerPage, owner);
    await gotoWhenHydrated(ownerPage, memberDetailPath, "main button");
    await clickByName(ownerPage, message("staff.action.suspend"));
    await clickInDialog(ownerPage, message("staff.action.suspend"));
    await waitForBadge(ownerPage, message("staff.status.suspended"));

    const inviteePage = await openPage(stack.browser, PHONE_VIEWPORT);
    await inviteePage.goto(`${ADMIN_ORIGIN}/sign-in`, { waitUntil: "networkidle0" });
    await inviteePage.waitForSelector("#identifier");
    await inviteePage.type("#identifier", inviteeEmail);
    await inviteePage.type("#password", TEST_PASSWORD);
    await inviteePage.click(SUBMIT_BUTTON);
    await inviteePage.waitForFunction(() => window.location.pathname !== "/sign-in");
    await inviteePage.goto(`${ADMIN_ORIGIN}/acme`, { waitUntil: "networkidle0" });
    const whileSuspended = await bodyText(inviteePage);

    await clickByName(ownerPage, message("staff.action.reactivate"));
    await clickInDialog(ownerPage, message("staff.action.reactivate"));
    await waitForBadge(ownerPage, message("staff.status.active"));
    await inviteePage.goto(`${ADMIN_ORIGIN}/acme`, { waitUntil: "networkidle0" });
    const afterReactivation = await bodyText(inviteePage);
    await closePage(ownerPage);
    await closePage(inviteePage);

    expect(whileSuspended).toContain(message("errors.not_found"));
    expect(whileSuspended).not.toContain(BUSINESS_NAME);
    expect(afterReactivation).toContain(BUSINESS_NAME);
  });
});

describe("initial JavaScript of the staff routes (13-UX section 11)", () => {
  it.each([
    "/acme",
    "/acme/settings/staff",
    "/acme/settings/staff/invitations",
    "/invitations/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ])("stays within the budget on %s", async (route) => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    const size = await measureInitialJs(page, route);
    await closePage(page);
    expect(toKiB(size.gzipBytes), route).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it("stays within the budget on a member's detail page", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    const size = await measureInitialJs(page, memberDetailPath);
    await closePage(page);
    expect(toKiB(size.gzipBytes)).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });
});

const viewports = [
  ["375", PHONE_VIEWPORT],
  ["1280", DESKTOP_VIEWPORT],
] as const;

describe.each(viewports)("screenshots at %s px in Bangla", (width, viewport) => {
  async function shoot(page: Page, name: string): Promise<void> {
    await page.screenshot({ path: `${screenshotDir}/${name}-${width}.png`, fullPage: true });
  }

  it.skipIf(!screenshotDir)(
    "saves home, staff list, member detail, invite sheet and accept page",
    async () => {
      await setTrialEndsInDays(stack, "acme", 3);
      const page = await openPage(stack.browser, viewport);
      await signInWithCookies(page, owner);
      await gotoWhenHydrated(page, "/acme", "header button");
      await waitForText(page, message("banner.trial.days").replace("{days}", "3"));
      await shoot(page, "home-trial-banner");
      await gotoWhenHydrated(page, "/acme/settings/staff", "main button");
      await shoot(page, "staff-list");
      await gotoWhenHydrated(page, memberDetailPath, "main button");
      await shoot(page, "member-detail");
      const link = await createInvitationThroughUi(
        page,
        `new-${width}-${Date.now()}@example.com`,
        "নতুন কর্মী",
      );
      await shoot(page, "invite-sheet");
      await closePage(page);

      const visitor = await openPage(stack.browser, viewport);
      await visitor.goto(link, { waitUntil: "networkidle0" });
      await waitForText(visitor, message("accept.signedOut"));
      await shoot(visitor, "accept-invitation");
      await closePage(visitor);
    },
  );
});
