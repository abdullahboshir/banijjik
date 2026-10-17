import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  clickButtonContaining,
  createInvitationThroughUi,
  gotoWhenHydrated,
  message,
  signUpAsInvitee,
  SUBMIT_BUTTON,
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
  seedCustomFields,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const BUSINESS_NAME = "আকমি ট্রেডার্স";
const INVITEE_NAME = "করিম হোসেন";
const BRANCH_CODE_LABEL = "শাখা কোড";
const NATIONAL_ID_LABEL = "জাতীয় পরিচয়পত্র";
const BRANCH_CODE = "DHK-01";
const NATIONAL_ID = "1990123456789";

let stack: BrowserStack;
let owner: SeededPerson;
let memberDetailPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", BUSINESS_NAME);
  await seedCustomFields(owner, "acme", [
    {
      entityType: "organization",
      fieldKey: "branch_code",
      label: { bn: BRANCH_CODE_LABEL, en: "Branch code" },
    },
    {
      entityType: "member",
      fieldKey: "national_id",
      label: { bn: NATIONAL_ID_LABEL, en: "National ID" },
    },
  ]);
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

async function waitForSheetClosed(page: import("puppeteer-core").Page): Promise<void> {
  await page.waitForSelector("[role=dialog]", { hidden: true });
}

describe("the business's own details", () => {
  it("lets the owner fill an organization field, save, reload and see it", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
    await clickByName(page, message("profile.edit"));
    await waitForDialogSettled(page);
    await page.type("#profile-custom-branch_code", BRANCH_CODE);
    await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
    await waitForSheetClosed(page);
    await gotoWhenHydrated(page, "/acme/settings/profile", "main button");
    await waitForText(page, BRANCH_CODE_LABEL);
    const text = await bodyText(page);
    await closePage(page);

    expect(text).toContain(message("customFields.title"));
    expect(text).toContain(BRANCH_CODE);
  });
});

describe("a staff member's details", () => {
  it("invites a member, then lets the owner fill a member field, save, and see it", async () => {
    const ownerPage = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(ownerPage, owner);
    const inviteeEmail = `karim-${Date.now()}@example.com`;
    const link = await createInvitationThroughUi(ownerPage, {
      identifier: inviteeEmail,
      displayName: INVITEE_NAME,
    });
    const inviteePage = await openPage(stack.browser, PHONE_VIEWPORT);
    await signUpAsInvitee(inviteePage, link, { name: INVITEE_NAME, email: inviteeEmail });
    await waitForPath(inviteePage, new URL(link).pathname);
    await clickByName(inviteePage, message("accept.submit"));
    await waitForPath(inviteePage, "/acme");
    await closePage(inviteePage);

    await gotoWhenHydrated(ownerPage, "/acme/settings/staff", "main button");
    await waitForText(ownerPage, INVITEE_NAME);
    await clickButtonContaining(ownerPage, INVITEE_NAME);
    await ownerPage.waitForFunction(() =>
      /\/settings\/staff\/[0-9a-f-]{36}$/.test(location.pathname),
    );
    memberDetailPath = await ownerPage.evaluate(() => window.location.pathname);
    await waitForText(ownerPage, message("staff.action.editDetails"));
    await clickByName(ownerPage, message("staff.action.editDetails"));
    await waitForDialogSettled(ownerPage);
    await ownerPage.type("#member-custom-national_id", NATIONAL_ID);
    await clickByName(ownerPage, message("common.save"));
    await waitForSheetClosed(ownerPage);
    await gotoWhenHydrated(ownerPage, memberDetailPath, "main button");
    await waitForText(ownerPage, NATIONAL_ID);
    const text = await bodyText(ownerPage);
    await closePage(ownerPage);

    expect(text).toContain(NATIONAL_ID_LABEL);
    expect(text).toContain(NATIONAL_ID);
  });
});

describe("initial JavaScript of the profile and member routes (13-UX section 11)", () => {
  it.each([
    ["profile", "/acme/settings/profile"],
    ["member detail", ""],
  ] as const)("stays within the budget on the %s", async (_name, route) => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    const path = route === "" ? memberDetailPath : route;
    const size = await measureInitialJs(page, path);
    process.stdout.write(
      `initial JS ${path}: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
    );
    await closePage(page);
    expect(toKiB(size.gzipBytes), path).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });
});
