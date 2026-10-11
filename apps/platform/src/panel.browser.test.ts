import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { banglaText } from "./test-support/bangla-text";
import {
  ADMIN_ORIGIN,
  PLATFORM_ORIGIN,
  PROBE_MODULE_KEY,
  effectiveModulesOf,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "./test-support/browser-stack";
import {
  PHONE_VIEWPORT,
  DESKTOP_VIEWPORT,
  bodyText,
  closePage,
  factOf,
  gotoHydrated,
  openPage,
  openSiblingPage,
  signInAsOperator,
  signInWithCookies,
  waitForButton,
  waitForText,
} from "./test-support/browser-page";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "./test-support/initial-js-size";
import {
  archivePackageNamed,
  createPackage,
  extendTrial,
  grantModule,
  openTenantFromList,
  submitSheetWithReason,
} from "./test-support/panel-steps";

declare global {
  interface ImportMetaEnv {
    /** When set, the screenshot tests save their pictures to this folder; otherwise they are skipped. */
    readonly SCREENSHOT_DIR?: string;
  }
}

const screenshotDir = import.meta.env.SCREENSHOT_DIR;
const TENANT_NAME = "আকমি ট্রেডার্স";
const TENANT_SLUG = "acme";
const PACKAGE_NAME = "প্রোব গোল্ড";
const POS_LABEL = "পিওএস";
const PROBE_MODULE_LABEL = "বুককিপিং";
/** The suspended page names the product after the sentence, so only the fixed beginning is compared. */
const SUSPENDED_PAGE_TEXT = banglaText("errors.org_suspended").split("{brand}")[0]?.trim() ?? "";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let tenantPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("আকমি মালিক");
  organizationId = await seedOrganization(owner, TENANT_SLUG, TENANT_NAME);
});

afterAll(async () => {
  await stack.stop();
});

/** The tab of the tenant's own member in the admin app, in the same browser as the operator. */
async function openMemberTab(operatorPage: Page): Promise<Page> {
  const memberPage = await openSiblingPage(operatorPage);
  await signInWithCookies(memberPage, owner);
  return memberPage;
}

/**
 * What the tenant's member sees at the business home once `expected` is on the page. The admin app keeps
 * prefetching its menu links, so the network never goes quiet: the wait is for the text, not for idleness.
 * A background tab does not run animation frames, so the tab that is about to act is brought to the front.
 */
async function memberSees(memberPage: Page, operatorPage: Page, expected: string): Promise<string> {
  await memberPage.bringToFront();
  await memberPage.goto(`${ADMIN_ORIGIN}/${TENANT_SLUG}`, { waitUntil: "domcontentloaded" });
  await waitForText(memberPage, expected);
  const text = await bodyText(memberPage);
  await operatorPage.bringToFront();
  return text;
}

describe("signing in to the platform app", () => {
  it("refuses a business user: the same message as a wrong password, and no session", async () => {
    const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await gotoHydrated(page, "/sign-in", "form button[type=submit]");
    await page.type("#identifier", owner.email);
    await page.type("#password", owner.password);
    await page.click("form button[type=submit]");
    await waitForText(page, banglaText("errors.invalid_credentials"));
    await page.goto(`${PLATFORM_ORIGIN}/tenants`, { waitUntil: "networkidle0" });
    const path = new URL(page.url()).pathname;
    await closePage(page);
    expect(path).toBe("/sign-in");
  });

  it("sends a visitor without a session to sign-in and keeps the page they asked for", async () => {
    const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await page.goto(`${PLATFORM_ORIGIN}/audit`, { waitUntil: "networkidle0" });
    const { pathname, search } = new URL(page.url());
    const text = await bodyText(page);
    await closePage(page);
    expect(pathname).toBe("/sign-in");
    expect(decodeURIComponent(search)).toContain("next=/audit");
    expect(text).toContain(banglaText("platform.band"));
  });
});

describe("an operator at work, with a tenant's member in another tab", () => {
  let operatorPage: Page;
  let memberPage: Page;

  beforeAll(async () => {
    operatorPage = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await signInAsOperator(operatorPage);
    memberPage = await openMemberTab(operatorPage);
  });

  beforeEach(async () => {
    await operatorPage.bringToFront();
  });

  afterAll(async () => {
    await closePage(operatorPage);
  });

  it("shows the Platform band and the menu the operator's permissions allow", async () => {
    const text = await bodyText(operatorPage);
    expect(text).toContain(banglaText("platform.band"));
    for (const key of ["tenants", "packages", "audit"]) {
      expect(text).toContain(banglaText(`platform.nav.${key}`));
    }
  });

  it("finds the tenant by search and opens it", async () => {
    tenantPath = await openTenantFromList(operatorPage, TENANT_SLUG, TENANT_NAME);
    expect(tenantPath).toBe(`/tenants/${organizationId}`);
  });

  it("suspends the tenant: its member sees the suspended page, and sees the business again once reactivated", async () => {
    await submitSheetWithReason(operatorPage, banglaText("platform.action.suspend"), {
      fieldId: "#status-reason",
      text: "ফি বকেয়া",
    });
    await waitForButton(operatorPage, banglaText("platform.action.reactivate"));
    const whileSuspended = await memberSees(memberPage, operatorPage, SUSPENDED_PAGE_TEXT);
    await submitSheetWithReason(operatorPage, banglaText("platform.action.reactivate"), {
      fieldId: "#status-reason",
      text: "ফি পরিশোধ হয়েছে",
    });
    await waitForButton(operatorPage, banglaText("platform.action.suspend"));
    const afterReactivation = await memberSees(memberPage, operatorPage, TENANT_NAME);
    expect(whileSuspended).toContain(SUSPENDED_PAGE_TEXT);
    expect(afterReactivation).not.toContain(SUSPENDED_PAGE_TEXT);
    expect(afterReactivation).toContain(TENANT_NAME);
  });

  it("grants a module: it shows in the overrides and in the member's config", async () => {
    await grantModule(operatorPage, PROBE_MODULE_KEY, "পাইলট গ্রাহক");
    await waitForText(operatorPage, PROBE_MODULE_LABEL);
    expect(await effectiveModulesOf(owner, organizationId)).toContain(PROBE_MODULE_KEY);
  });

  it("extends the trial", async () => {
    const term = banglaText("platform.subscription.trialEnds");
    const before = await factOf(operatorPage, term);
    await extendTrial(operatorPage, "7", "ডেমোর জন্য");
    await operatorPage.waitForFunction(
      (label, previous) =>
        Array.from(document.querySelectorAll("dt"))
          .find((e) => e.textContent?.trim() === label)
          ?.nextElementSibling?.textContent?.trim() !== previous,
      {},
      term,
      before,
    );
    expect(await factOf(operatorPage, term)).not.toBe(before);
  });

  it("creates a package and then archives it", async () => {
    await createPackage(operatorPage, {
      packageKey: "PROBE_GOLD",
      name: PACKAGE_NAME,
      moduleLabel: POS_LABEL,
    });
    await archivePackageNamed(operatorPage, PACKAGE_NAME);
    expect(await bodyText(operatorPage)).toContain(banglaText("platform.status.package.ARCHIVED"));
  });

  it("lists those actions in the audit log", async () => {
    await operatorPage.goto(`${PLATFORM_ORIGIN}/audit`, { waitUntil: "networkidle0" });
    const text = await bodyText(operatorPage);
    for (const action of [
      "platform.tenant.suspended",
      "platform.tenant.reactivated",
      "platform.moduleOverride.created",
      "platform.subscription.trialExtended",
      "platform.package.created",
      "platform.package.archived",
    ]) {
      expect(text, action).toContain(banglaText(`platform.audit.action.${action}`));
    }
  });

  describe("initial JavaScript of the routes (13-UX section 11)", () => {
    const routes = (): string[] => [
      "/tenants",
      tenantPath,
      "/packages",
      "/packages/new",
      "/audit",
      "/sign-in",
    ];

    it("stays within the budget on every route", async () => {
      const failures: string[] = [];
      for (const route of routes()) {
        const size = await measureInitialJs(operatorPage, route);
        process.stdout.write(
          `initial JS ${route}: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
        );
        if (toKiB(size.gzipBytes) > INITIAL_JS_BUDGET_KIB) failures.push(route);
      }
      expect(failures).toEqual([]);
    });
  });
});

describe("the two audiences keep their sessions apart", () => {
  async function pathAfterVisiting(page: Page, url: string): Promise<string> {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.location.pathname === "/sign-in");
    return new URL(page.url()).pathname;
  }

  it("does not let an operator session open the admin app", async () => {
    const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await signInAsOperator(page);
    const path = await pathAfterVisiting(page, `${ADMIN_ORIGIN}/${TENANT_SLUG}`);
    await closePage(page);
    expect(path).toBe("/sign-in");
  });

  it("does not let a business session open the platform app", async () => {
    const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await signInWithCookies(page, owner);
    const path = await pathAfterVisiting(page, `${PLATFORM_ORIGIN}/tenants`);
    await closePage(page);
    expect(path).toBe("/sign-in");
  });
});

describe("the panel on a phone (13-UX section 12: read-only use in an emergency)", () => {
  it("never scrolls sideways at 375 px on any page", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInAsOperator(page);
    const widerThanScreen: string[] = [];
    for (const route of ["/tenants", tenantPath, "/packages", "/packages/new", "/audit"]) {
      await page.goto(`${PLATFORM_ORIGIN}${route}`, { waitUntil: "networkidle0" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0) widerThanScreen.push(`${route} (+${overflow}px)`);
    }
    await closePage(page);
    expect(widerThanScreen).toEqual([]);
  });
});

describe.skipIf(!screenshotDir)("screenshots in Bangla", () => {
  const viewports = [
    ["1280", DESKTOP_VIEWPORT],
    ["375", PHONE_VIEWPORT],
  ] as const;

  async function shoot(page: Page, name: string, width: string): Promise<void> {
    await page.screenshot({ path: `${screenshotDir}/${name}-${width}.png`, fullPage: true });
  }

  it.each(viewports)("takes the pictures at %s px", async (width, viewport) => {
    const page = await openPage(stack.browser, viewport);
    await page.goto(`${PLATFORM_ORIGIN}/sign-in`, { waitUntil: "networkidle0" });
    await shoot(page, "sign-in", width);
    await signInAsOperator(page);
    const pages: [string, string][] = [
      ["tenants", "/tenants"],
      ["tenant-detail", tenantPath],
      ["packages", "/packages"],
      ["package-new", "/packages/new"],
      ["audit", "/audit"],
    ];
    for (const [name, path] of pages) {
      await page.goto(`${PLATFORM_ORIGIN}${path}`, { waitUntil: "networkidle0" });
      await shoot(page, name, width);
    }
    await closePage(page);
  });
});
