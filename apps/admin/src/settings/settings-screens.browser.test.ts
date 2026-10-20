import { mkdirSync } from "node:fs";
import { PERMISSION_KEY } from "@banijjik/contracts";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clickButton,
  clickInDialog,
  createInvitationThroughUi,
  gotoWhenHydrated,
  message,
  signUpAsInvitee,
  SUBMIT_BUTTON,
  waitForPath,
  waitForText,
  waitForTextIn,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  DESKTOP_VIEWPORT,
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
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

declare global {
  interface ImportMetaEnv {
    /** When set, the screenshot tests save their pictures to this folder; otherwise they are skipped. */
    readonly SCREENSHOT_DIR?: string;
  }
}

const screenshotDir = import.meta.env.SCREENSHOT_DIR;
const BUSINESS_NAME = "আকমি ট্রেডার্স";
const NEW_BUSINESS_NAME = "আকমি ট্রেডার্স লিমিটেড";
const SECOND_LOCATION_NAME = "দ্বিতীয় শাখা";
const ROLE_NAME = "বিক্রয় সহকারী";
const MEMBER_NAME = "করিম হোসেন";
const ROLE_PERMISSIONS = [
  PERMISSION_KEY.ORGANIZATION_MEMBER_READ,
  PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE,
];
/** The seeded business is on the retail template, whose own word for a location is "শাখা" (card 2.8). */
const TEMPLATE_LOCATION_TERM = "শাখা";

/** A message with the {term} placeholder, filled with the word the business uses for a location. */
function withLocationTerm(messageKey: string): string {
  return message(messageKey).replace("{term}", TEMPLATE_LOCATION_TERM);
}

const LOCATIONS_LINK = 'a[href="/acme/settings/locations"]';

let stack: BrowserStack;
let owner: SeededPerson;
let memberEmail: string;
let roleDetailPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  memberEmail = `member-${Date.now()}@example.com`;
  if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(
  viewport: { width: number; height: number } = PHONE_VIEWPORT,
): Promise<Page> {
  const page = await openPage(stack.browser, viewport);
  await signInWithCookies(page, owner);
  return page;
}

async function hasLink(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((css) => document.querySelector(css) !== null, selector);
}

async function waitForSheetClosed(page: Page): Promise<void> {
  await page.waitForSelector("[role=dialog]", { hidden: true });
}

/** Ticks a checkbox in the open sheet by the text of its label. */
async function tickInSheet(page: Page, label: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => {
      const found = Array.from(document.querySelectorAll("[role=dialog] label")).find(
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

/** Clicks a visible button, with exactly this label, in the first card or table row that shows the text. */
async function clickInRow(page: Page, rowText: string, buttonLabel: string): Promise<void> {
  await page.waitForFunction(
    (row, label) => {
      const rows = Array.from(document.querySelectorAll("main li, main tr")).filter((candidate) =>
        candidate.textContent?.includes(row),
      );
      const buttons = rows.flatMap((candidate) => Array.from(candidate.querySelectorAll("button")));
      const button = buttons.find(
        (candidate) =>
          candidate.textContent?.trim() === label && candidate.getClientRects().length > 0,
      );
      button?.setAttribute("data-row-target", "true");
      return button !== undefined;
    },
    {},
    rowText,
    buttonLabel,
  );
  await page.click("[data-row-target]");
  await page.evaluate(() =>
    document.querySelector("[data-row-target]")?.removeAttribute("data-row-target"),
  );
}

/** The labels of the buttons in the page body; the page text also carries the whole message catalog. */
async function buttonLabelsOfMain(page: Page): Promise<string[]> {
  return page.$$eval("main button", (buttons) => buttons.map((button) => button.textContent ?? ""));
}

/** The topic cards of the settings home: one h2 each. */
async function topicTitlesOfMain(page: Page): Promise<string[]> {
  return page.$$eval("main h2", (headings) => headings.map((heading) => heading.textContent ?? ""));
}

async function topBarText(page: Page): Promise<string> {
  return page.$eval("header", (header) => header.textContent ?? "");
}

describe("the settings home", () => {
  it("shows an owner the Business, Team and Advanced topics with their pages, and fits the phone", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings", "main h2");
    const topics = await topicTitlesOfMain(page);
    const pagePaths = await page.$$eval("main a", (links) =>
      links.map((link) => (link as HTMLAnchorElement).pathname),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await closePage(page);

    expect(topics).toEqual([
      message("settings.topic.BUSINESS.title"),
      message("settings.topic.TEAM.title"),
      message("settings.topic.SALES.title"),
      message("settings.topic.ADVANCED.title"),
    ]);
    expect(pagePaths).toEqual(
      expect.arrayContaining([
        "/acme/settings/profile",
        "/acme/settings/general",
        "/acme/settings/terms",
        "/acme/settings/staff",
        "/acme/settings/roles",
        "/acme/settings/fields",
        "/acme/settings/modules",
      ]),
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

describe("the business profile", () => {
  it("lets the owner rename the business and shows the new name in the top bar after a reload", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
    await clickByName(page, message("profile.edit"));
    await waitForDialogSettled(page);
    await page.click("#profile-name", { clickCount: 3 });
    await page.type("#profile-name", NEW_BUSINESS_NAME);
    await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
    await waitForSheetClosed(page);
    await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
    const topBar = await topBarText(page);
    await closePage(page);

    expect(topBar).toContain(NEW_BUSINESS_NAME);
  });
});

describe("locations", () => {
  it("adds a second location from the profile page, which brings the Locations menu entry", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
    const hadEntryBefore = await hasLink(page, LOCATIONS_LINK);
    await clickByName(page, withLocationTerm("profile.locations.add"));
    await waitForDialogSettled(page);
    await page.type("#location-name", SECOND_LOCATION_NAME);
    await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
    await waitForSheetClosed(page);
    await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
    const hasEntryAfter = await hasLink(page, LOCATIONS_LINK);
    await closePage(page);

    expect(hadEntryBefore).toBe(false);
    expect(hasEntryAfter).toBe(true);
  });

  it("refuses to archive the default location and says why", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/locations", "main button");
    await waitForText(page, SECOND_LOCATION_NAME);
    await clickInRow(page, message("locations.default"), message("locations.archive"));
    await clickInDialog(page, message("locations.archive"));
    await waitForText(page, message("errors.location_is_default"));
    await closePage(page);
  });
});

describe("roles", () => {
  it("lets the owner create a custom role with two permissions and open it", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/roles", "main button");
    await clickByName(page, message("roles.add"));
    await waitForDialogSettled(page);
    await page.type("#role-name", ROLE_NAME);
    for (const permissionKey of ROLE_PERMISSIONS) {
      await tickInSheet(page, message(`permission.${permissionKey}`));
    }
    await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
    await waitForSheetClosed(page);
    await waitForText(page, ROLE_NAME);
    await gotoWhenHydrated(page, "/acme/settings/roles", "main button");
    await waitForTextIn(page, "main", ROLE_NAME);
    await clickButton(page, "main button", (text) => text.includes(ROLE_NAME));
    await page.waitForFunction(() => /\/settings\/roles\/[0-9a-f-]{36}$/.test(location.pathname));
    roleDetailPath = await page.evaluate(() => window.location.pathname);
    await waitForText(page, message(`permission.${ROLE_PERMISSIONS[0]}`));
    await closePage(page);
  });

  it("gives an invited member of that role exactly the matching menu entries and actions", async () => {
    const inviterPage = await ownerPage();
    const link = await createInvitationThroughUi(inviterPage, {
      identifier: memberEmail,
      displayName: MEMBER_NAME,
      roleName: ROLE_NAME,
    });
    await closePage(inviterPage);

    const member = await openPage(stack.browser, PHONE_VIEWPORT);
    await signUpAsInvitee(member, link, { name: MEMBER_NAME, email: memberEmail });
    await waitForPath(member, new URL(link).pathname);
    await clickByName(member, message("accept.submit"));
    await waitForPath(member, "/acme");
    await waitForText(member, NEW_BUSINESS_NAME);
    const menuPaths = await member.evaluate(() =>
      [...new Set(Array.from(document.querySelectorAll("a")).map((a) => a.pathname))]
        .filter((path) => path.startsWith("/acme"))
        .sort(),
    );
    await gotoWhenHydrated(member, "/acme/settings/staff", "main");
    await waitForTextIn(member, "main", MEMBER_NAME);
    const staffActionPaths = await member.evaluate(() =>
      Array.from(document.querySelectorAll("main a")).map((a) => (a as HTMLAnchorElement).pathname),
    );
    await gotoWhenHydrated(member, "/acme/settings/profile", "main button");
    const profilePage = await member.evaluate(() => document.body.textContent ?? "");
    await gotoWhenHydrated(member, "/acme/settings/locations", "main");
    const locationsPage = await member.evaluate(() => document.body.textContent ?? "");
    await gotoWhenHydrated(member, "/acme/settings", "main h2");
    const memberTopics = await topicTitlesOfMain(member);
    await closePage(member);

    // The settings home entry (ADR-112) is the first entry of the settings group, so it is in the menu too.
    expect(menuPaths).toEqual([
      "/acme",
      "/acme/settings",
      "/acme/settings/branding",
      "/acme/settings/profile",
      "/acme/settings/staff",
    ]);
    expect(memberTopics).toEqual([
      message("settings.topic.BUSINESS.title"),
      message("settings.topic.TEAM.title"),
    ]);
    expect(staffActionPaths).not.toContain("/acme/settings/staff/invitations");
    expect(staffActionPaths).not.toContain("/acme/settings/roles");
    expect(profilePage).toContain(message("profile.edit"));
    expect(locationsPage).toContain(message("state.permissionDenied"));
  });

  it("refuses to archive a role that a member still has and says how many", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, roleDetailPath, "main button");
    await clickByName(page, message("roles.archive"));
    await clickInDialog(page, message("roles.archive"));
    await waitForText(page, message("roles.archive.inUse").replace("{count}", "1"));
    await closePage(page);
  });
});

const BRANCH_MANAGER_NAME = "সালমা বেগম";
const BRANCH_STAFF_NAME = "জামাল মিয়া";
const STAFF_LINK = "/acme/settings/staff";

/** Invites a person to the second location only, and returns the page they land on after accepting. */
async function joinSecondLocationAs(invitee: { name: string; roleName?: string }): Promise<Page> {
  const email = `branch-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  const inviterPage = await ownerPage();
  const link = await createInvitationThroughUi(inviterPage, {
    identifier: email,
    displayName: invitee.name,
    locationName: SECOND_LOCATION_NAME,
    ...(invitee.roleName === undefined ? {} : { roleName: invitee.roleName }),
  });
  await closePage(inviterPage);
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signUpAsInvitee(page, link, { name: invitee.name, email });
  await waitForPath(page, new URL(link).pathname);
  await clickByName(page, message("accept.submit"));
  await waitForPath(page, "/acme");
  return page;
}

describe("a manager of one location (review M3)", () => {
  it("sees only the staff of that location and is not offered the profile edit or the audit log", async () => {
    const staffPage = await joinSecondLocationAs({ name: BRANCH_STAFF_NAME, roleName: ROLE_NAME });
    await closePage(staffPage);
    const manager = await joinSecondLocationAs({ name: BRANCH_MANAGER_NAME });
    const menuPaths = await manager.evaluate(() =>
      [...new Set(Array.from(document.querySelectorAll("a")).map((a) => a.pathname))]
        .filter((path) => path.startsWith("/acme"))
        .sort(),
    );
    await gotoWhenHydrated(manager, STAFF_LINK, "main");
    await waitForTextIn(manager, "main", BRANCH_STAFF_NAME);
    const staffList = await manager.$eval("main", (main) => (main as HTMLElement).innerText);
    await gotoWhenHydrated(manager, "/acme/settings/profile", "main");
    await waitForTextIn(manager, "main", NEW_BUSINESS_NAME);
    // Buttons only: the page text also carries the whole message catalog in its script data.
    const profileButtons = await manager.$$eval("main button", (buttons) =>
      buttons.map((button) => button.textContent ?? ""),
    );
    await gotoWhenHydrated(manager, "/acme/settings/locations", "main");
    await waitForTextIn(manager, "main", SECOND_LOCATION_NAME);
    const locationButtons = await buttonLabelsOfMain(manager);
    await gotoWhenHydrated(manager, "/acme/settings/roles", "main");
    await waitForTextIn(manager, "main", ROLE_NAME);
    const roleButtons = await buttonLabelsOfMain(manager);
    await closePage(manager);

    expect(locationButtons).not.toContain(withLocationTerm("locations.add"));
    expect(locationButtons).not.toContain(message("locations.edit"));
    expect(locationButtons).not.toContain(message("locations.archive"));
    expect(roleButtons).not.toContain(message("roles.add"));
    expect(menuPaths).toContain(STAFF_LINK);
    expect(menuPaths).not.toContain("/acme/settings/profile");
    expect(staffList).toContain(BRANCH_MANAGER_NAME);
    expect(staffList).not.toContain(MEMBER_NAME);
    expect(staffList).not.toContain(owner.name);
    expect(profileButtons).not.toContain(message("profile.edit"));
  });
});

describe("initial JavaScript of the settings routes (13-UX section 11)", () => {
  it.each([
    "/acme/settings/profile",
    "/acme/settings/locations",
    "/acme/settings/roles",
    "/acme/settings/roles/ROLE",
  ])("stays within the budget on %s", async (route) => {
    const page = await ownerPage();
    const path = route.replace("/acme/settings/roles/ROLE", roleDetailPath);
    const size = await measureInitialJs(page, path);
    process.stdout.write(
      `initial JS ${route}: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
    );
    await closePage(page);

    expect(toKiB(size.gzipBytes), route).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
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

  async function shootSheet(page: Page, name: string, openLabel: string): Promise<void> {
    await clickByName(page, openLabel);
    await waitForDialogSettled(page);
    await shoot(page, name);
    await page.keyboard.press("Escape");
    await waitForSheetClosed(page);
  }

  it.skipIf(!screenshotDir)(
    "saves profile, locations, roles, role detail and the form sheets",
    async () => {
      const page = await ownerPage(viewport);
      await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
      await shoot(page, "profile");
      await shootSheet(page, "profile-form", message("profile.edit"));
      await gotoWhenHydrated(page, "/acme/settings/locations", "main button");
      await waitForText(page, SECOND_LOCATION_NAME);
      await shoot(page, "locations");
      await shootSheet(page, "location-form", withLocationTerm("locations.add"));
      await gotoWhenHydrated(page, "/acme/settings/roles", "main button");
      await waitForText(page, ROLE_NAME);
      await shoot(page, "roles");
      await shootSheet(page, "role-form", message("roles.add"));
      await gotoWhenHydrated(page, roleDetailPath, "main button");
      await shoot(page, "role-detail");
      await closePage(page);
    },
  );
});
