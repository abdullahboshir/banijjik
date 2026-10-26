import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createInvitationThroughUi,
  gotoWhenHydrated,
  message,
  signUpAsInvitee,
  waitForPath,
  waitForText,
} from "../test-support/browser-helpers";
import {
  clickByName,
  waitForHydration,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import {
  ADMIN_ORIGIN,
  API_PORT,
  organizationIdOf,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { measureInitialJs, toKiB } from "../test-support/initial-js-size";

/** M.6c C8: the admin `website/pages` route stays within 180 KiB of initial JavaScript. */
const ADMIN_ROUTE_BUDGET_KIB = 180;
/** The invitation helper of the admin browser tests opens the business `acme` (test-support/browser-helpers). */
const SLUG = "acme";
const ORG_NAME = "অ্যাক্মে";
const PAGE_PATH = `/${SLUG}/website/pages`;
const ABOUT_TITLE = "About Webco";
const ABOUT_BODY = "Hello **Webco**";
const STALE_TITLE = "Edited elsewhere";
const STAFF_ROLE = "স্টাফ";
const STAFF_NAME = "স্টাফ সদস্য";
const API_ORIGIN = `http://localhost:${API_PORT}`;
const SAVE_TIMEOUT_MS = 30_000;
const POLL_MS = 500;
const HTTP_OK = 200;

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("ওয়েব মালিক");
  await seedOrganization(owner, SLUG, ORG_NAME);
  organizationId = await organizationIdOf(owner, SLUG);
  await grantWebsiteModule(organizationId);
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

/** The website module is optional; the test business turns it on the way a platform grant does. */
async function grantWebsiteModule(organizationIdToGrant: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const now = new Date();
    await client.db("browser_platform").collection("module_overrides").insertOne({
      moduleOverrideId: newId(),
      organizationId: organizationIdToGrant,
      moduleKey: MODULE_KEY.WEBSITE,
      effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
      reason: "browser test",
      expiresAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });
    await client
      .db("browser_platform")
      .collection("organizations")
      .updateOne({ organizationId: organizationIdToGrant }, { $inc: { configVersion: 1 } });
  } finally {
    await client.close();
  }
}

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

/** Waits until the ABOUT editor is drawn with the stored page (the title field exists). */
async function openPagesEditor(page: Page): Promise<void> {
  await gotoWhenHydrated(page, PAGE_PATH, "#page-title-ABOUT-en");
}

async function saveAbout(page: Page): Promise<void> {
  await clickByName(page, message("website.pages.save"));
}

/** A version-checked PUT straight to the API, as another editor would send it. */
async function putAboutAsOtherEditor(version: number, title: string): Promise<void> {
  const cookieHeader = owner.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const response = await fetch(`${API_ORIGIN}/api/v1/orgs/${organizationId}/website/pages/ABOUT`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: ADMIN_ORIGIN,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      title: { bn: "", en: title },
      body: { bn: "", en: ABOUT_BODY },
      isPublished: true,
      version,
    }),
  });
  if (!response.ok) throw new Error(`other editor's save answered ${response.status}`);
}

interface StorefrontReading {
  readonly status: number;
  readonly title: string | undefined;
}

/** The storefront read of ABOUT, polled to a deadline; returns the last reading (the status is in the report). */
async function waitForStorefrontAbout(expectedTitle: string): Promise<StorefrontReading> {
  const deadline = Date.now() + SAVE_TIMEOUT_MS;
  let reading: StorefrontReading = { status: 0, title: undefined };
  while (Date.now() < deadline) {
    reading = await readStorefrontAbout();
    if (reading.title === expectedTitle) return reading;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return reading;
}

async function readStorefrontAbout(): Promise<StorefrontReading> {
  const response = await fetch(
    `${API_ORIGIN}/api/v1/storefront/orgs/${organizationId}/pages/ABOUT`,
  );
  if (response.status !== HTTP_OK) return { status: response.status, title: undefined };
  const body = (await response.json()) as { data: { title: { en: string } } };
  return { status: response.status, title: body.data.title.en };
}

describe("the website page editor", () => {
  it("edits and publishes a page, and the storefront read shows it", async () => {
    const page = await ownerPage();
    await openPagesEditor(page);
    await page.type("#page-title-ABOUT-en", ABOUT_TITLE);
    await page.type("#page-body-ABOUT-en", ABOUT_BODY);
    await waitForHydration(page, "#page-publish-ABOUT");
    await page.click("#page-publish-ABOUT");
    // The save must carry the published state: confirm the switch took it before saving.
    await page.waitForFunction(
      () =>
        (document.getElementById("page-publish-ABOUT") as HTMLInputElement | null)?.checked ===
        true,
      { timeout: SAVE_TIMEOUT_MS, polling: POLL_MS },
    );
    await saveAbout(page);
    await waitForText(page, message("website.pages.saved"));
    await closePage(page);

    expect(await waitForStorefrontAbout(ABOUT_TITLE)).toEqual({
      status: HTTP_OK,
      title: ABOUT_TITLE,
    });
  });

  it(
    "refuses a stale save with the conflict message and keeps the other editor's version",
    async () => {
      const page = await ownerPage();
      await openPagesEditor(page);
      // The page was opened at the stored version; another editor saves first.
      const stored = await fetch(`${API_ORIGIN}/api/v1/orgs/${organizationId}/website/pages`, {
        headers: {
          Cookie: owner.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
        },
      });
      const pages = ((await stored.json()) as { data: { pageKey: string; version: number }[] })
        .data;
      const version = pages.find((row) => row.pageKey === "ABOUT")?.version ?? 0;
      await putAboutAsOtherEditor(version, "Saved by someone else");
      await page.type("#page-title-ABOUT-en", STALE_TITLE);
      await saveAbout(page);
      await waitForText(page, message("website.pages.conflict"));
      await closePage(page);

      expect(await waitForStorefrontAbout("Saved by someone else")).toEqual({
        status: HTTP_OK,
        title: "Saved by someone else",
      });
    },
    SAVE_TIMEOUT_MS,
  );

  it("shows staff the pages read-only", async () => {
    const inviter = await ownerPage();
    const memberEmail = `staff-${Date.now()}@example.com`;
    const link = await createInvitationThroughUi(inviter, {
      identifier: memberEmail,
      displayName: STAFF_NAME,
      roleName: STAFF_ROLE,
    });
    await closePage(inviter);

    const staff = await openPage(stack.browser, PHONE_VIEWPORT);
    await signUpAsInvitee(staff, link, { name: STAFF_NAME, email: memberEmail });
    await waitForPath(staff, new URL(link).pathname);
    await clickByName(staff, message("accept.submit"));
    await waitForPath(staff, `/${SLUG}`);
    await gotoWhenHydrated(staff, PAGE_PATH, "#page-title-ABOUT-en");
    const titleDisabled = await staff.$eval(
      "#page-title-ABOUT-en",
      (node) => (node as HTMLInputElement).disabled,
    );
    const readOnlyText = await staff.evaluate(
      (text) => document.body.textContent?.includes(text) ?? false,
      message("website.pages.readOnly"),
    );
    await closePage(staff);

    expect(titleDisabled).toBe(true);
    expect(readOnlyText).toBe(true);
  }, 120_000);

  it("stays within the initial JavaScript budget of the page route", async () => {
    const page = await ownerPage();
    await openPagesEditor(page);
    const size = await measureInitialJs(page, PAGE_PATH);
    process.stdout.write(`initial JS website pages: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), "website pages").toBeLessThanOrEqual(ADMIN_ROUTE_BUDGET_KIB);
  });
});
