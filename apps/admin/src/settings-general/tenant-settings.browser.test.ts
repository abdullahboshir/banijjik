import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  clickButtonContaining,
  clickInDialog,
  createInvitationThroughUi,
  gotoWhenHydrated,
  message,
  signUpAsInvitee,
  waitForPath,
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
  seedTemplateField,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const BUSINESS_NAME = "আকমি ট্রেডার্স";
const STAFF_NAME = "জামাল উদ্দিন";
const API_ORIGIN = "http://localhost:4000";
const NEW_TERM_BN = "আউটলেট";
const NEW_TERM_EN = "Outlet";
const NEW_FIELD_KEY = "grade";
const NEW_FIELD_BN = "গ্রেড";
const TEMPLATE_FIELD_BN = "শিফট";
const TENANT_ROUTES = [
  "/acme/settings/general",
  "/acme/settings/terms",
  "/acme/settings/fields",
  "/acme/settings/modules",
];
/** The tenant routes plus the settings home (card 3.13), which every member opens. */
const PHONE_FIT_ROUTES = [...TENANT_ROUTES, "/acme/settings"];

let stack: BrowserStack;
let owner: SeededPerson;
let staffEmail: string;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  await seedTemplateField(stack, "acme", {
    entityType: "member",
    fieldKey: "shift",
    fieldType: "TEXT",
    isRequired: false,
    label: { bn: TEMPLATE_FIELD_BN, en: "Shift" },
  });
  staffEmail = `jamal-${Date.now()}@example.com`;
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

async function waitForSheetClosed(page: Page): Promise<void> {
  await page.waitForSelector("[role=dialog]", { hidden: true });
}

/** Clicks a button, by its exact label, inside the first list row or card whose text contains the row text. */
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

async function rowTextOf(page: Page, rowText: string): Promise<string> {
  return page.evaluate((wanted) => {
    const rows = Array.from(document.querySelectorAll("main li, main tr"));
    return rows.find((row) => row.textContent?.includes(wanted))?.textContent ?? "";
  }, rowText);
}

describe("an owner manages the business from the settings pages", () => {
  it("switches the digits to Bengali and sees the Business badge on that setting", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/general", "main button");
    await clickInRow(
      page,
      message("setting.organization.digitScript"),
      message("settings.general.change"),
    );
    await waitForDialogSettled(page);
    await page.select("#setting-value", "BENGALI");
    await clickByName(page, message("common.save"));
    await waitForSheetClosed(page);
    await gotoWhenHydrated(page, "/acme/settings/general", "main button");
    const row = await rowTextOf(page, message("setting.organization.digitScript"));
    await closePage(page);

    expect(row).toContain(message("setting.organization.digitScript.BENGALI"));
    expect(row).toContain(message("settings.source.ORGANIZATION"));
  });

  it("renames the term location, which the resolved config then carries", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/terms", "main button");
    await clickInRow(page, message("terms.key.location"), message("terms.change"));
    await waitForDialogSettled(page);
    await page.click("#term-bn", { clickCount: 3 });
    await page.type("#term-bn", NEW_TERM_BN);
    await page.click("#term-en", { clickCount: 3 });
    await page.type("#term-en", NEW_TERM_EN);
    await clickByName(page, message("common.save"));
    await waitForSheetClosed(page);
    await gotoWhenHydrated(page, "/acme/settings/terms", "main button");
    await waitForText(page, NEW_TERM_BN);
    const row = await rowTextOf(page, message("terms.key.location"));
    const organizationId = await page.evaluate(async (api) => {
      const response = await fetch(`${api}/api/v1/me/orgs`, { credentials: "include" });
      const body = (await response.json()) as { data: { organizationId: string }[] };
      return body.data[0]?.organizationId ?? "";
    }, API_ORIGIN);
    const configTerm = await page.evaluate(
      async (api, id) => {
        const response = await fetch(`${api}/api/v1/orgs/${id}/me/config`, {
          credentials: "include",
        });
        const body = (await response.json()) as {
          data: { terms: Record<string, { bn: string; en: string }> };
        };
        return body.data.terms["location"];
      },
      API_ORIGIN,
      organizationId,
    );
    await closePage(page);

    expect(row).toContain(NEW_TERM_EN);
    expect(row).toContain(message("terms.source.ORGANIZATION"));
    expect(configTerm).toEqual({ bn: NEW_TERM_BN, en: NEW_TERM_EN });
  });

  it("creates a business field on staff and sees it on a staff member's details", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/fields?entity=member", "main button");
    await clickByName(page, message("fields.add"));
    await waitForDialogSettled(page);
    await page.type("#field-fieldKey", NEW_FIELD_KEY);
    await page.type("#field-labelBn", NEW_FIELD_BN);
    await page.type("#field-labelEn", "Grade");
    await clickByName(page, message("common.save"));
    await waitForSheetClosed(page);
    await waitForText(page, NEW_FIELD_KEY);

    await gotoWhenHydrated(page, "/acme/settings/staff", "main button");
    await clickButtonContaining(page, "রহিম উদ্দিন");
    await page.waitForFunction(() => /\/settings\/staff\/[0-9a-f-]{36}$/.test(location.pathname));
    await waitForText(page, NEW_FIELD_BN);
    const text = await bodyText(page);
    await closePage(page);

    expect(text).toContain(NEW_FIELD_BN);
  });

  it("hides an optional template field, which then disappears from the staff edit sheet", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/staff", "main button");
    await clickButtonContaining(page, "রহিম উদ্দিন");
    await page.waitForFunction(() => /\/settings\/staff\/[0-9a-f-]{36}$/.test(location.pathname));
    await clickByName(page, message("staff.action.editDetails"));
    await waitForDialogSettled(page);
    const before = await page.evaluate(
      () => document.querySelector("[role=dialog]")?.textContent ?? "",
    );
    await page.keyboard.press("Escape");
    await waitForSheetClosed(page);
    const memberPath = await page.evaluate(() => window.location.pathname);

    await gotoWhenHydrated(page, "/acme/settings/fields?entity=member", "main button");
    await clickInRow(page, TEMPLATE_FIELD_BN, message("fields.hide"));
    await waitForDialogSettled(page);
    await clickInDialog(page, message("fields.hide.title"));
    await waitForSheetClosed(page);

    await gotoWhenHydrated(page, memberPath, "main button");
    await clickByName(page, message("staff.action.editDetails"));
    await waitForDialogSettled(page);
    const after = await page.evaluate(
      () => document.querySelector("[role=dialog]")?.textContent ?? "",
    );
    await closePage(page);

    expect(before).toContain(TEMPLATE_FIELD_BN);
    expect(after).not.toContain(TEMPLATE_FIELD_BN);
  });
});

describe("a hidden template field can be shown again", () => {
  it("lists it as hidden, and after Show again it is back in the staff edit sheet", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/settings/fields?entity=member", "main button");
    const hiddenRow = await rowTextOf(page, TEMPLATE_FIELD_BN);
    await clickInRow(page, TEMPLATE_FIELD_BN, message("fields.show"));
    await waitForDialogSettled(page);
    await clickInDialog(page, message("fields.show.title"));
    await waitForSheetClosed(page);

    await gotoWhenHydrated(page, "/acme/settings/staff", "main button");
    await clickButtonContaining(page, "রহিম উদ্দিন");
    await page.waitForFunction(() => /\/settings\/staff\/[0-9a-f-]{36}$/.test(location.pathname));
    await clickByName(page, message("staff.action.editDetails"));
    await waitForDialogSettled(page);
    const sheet = await page.evaluate(
      () => document.querySelector("[role=dialog]")?.textContent ?? "",
    );
    await closePage(page);

    expect(hiddenRow).toContain(message("fields.trait.hidden"));
    expect(sheet).toContain(TEMPLATE_FIELD_BN);
  });
});

describe("a staff member sees the pages without edit buttons", () => {
  it("opens settings, words, fields and modules read-only", async () => {
    const ownerSide = await ownerPage();
    const link = await createInvitationThroughUi(ownerSide, {
      identifier: staffEmail,
      displayName: STAFF_NAME,
      roleName: message("role.staff"),
    });
    await closePage(ownerSide);
    const inviteePage = await openPage(stack.browser, PHONE_VIEWPORT);
    await signUpAsInvitee(inviteePage, link, { name: STAFF_NAME, email: staffEmail });
    await waitForPath(inviteePage, new URL(link).pathname);
    await clickByName(inviteePage, message("accept.submit"));
    await waitForPath(inviteePage, "/acme");

    const pages: Record<string, string> = {};
    const mainTexts: string[] = [];
    for (const route of TENANT_ROUTES) {
      await gotoWhenHydrated(inviteePage, route, "main");
      mainTexts.push(await inviteePage.$eval("main", (main) => main.textContent ?? ""));
      pages[route] = await inviteePage.evaluate(() =>
        Array.from(document.querySelectorAll("main button"))
          .map((button) => button.textContent?.trim() ?? "")
          .join("|"),
      );
    }
    await closePage(inviteePage);

    expect(Object.values(pages).every((buttons) => buttons === "")).toBe(true);
    expect(mainTexts.every((mainText) => mainText.length > 0)).toBe(true);
    expect(mainTexts.some((mainText) => mainText.includes(message("state.permissionDenied")))).toBe(
      false,
    );
  });
});

describe("the new routes fit the phone", () => {
  it.each(PHONE_FIT_ROUTES)(
    "stays within the JavaScript budget and the width on %s",
    async (route) => {
      const page = await ownerPage();
      const size = await measureInitialJs(page, route);
      process.stdout.write(
        `initial JS ${route}: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      await closePage(page);

      expect(toKiB(size.gzipBytes), route).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
      expect(overflow, route).toBeLessThanOrEqual(0);
    },
  );
});
