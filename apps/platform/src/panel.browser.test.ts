import { newId } from "@banijjik/ids";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { banglaText } from "./test-support/bangla-text";
import {
  ADMIN_ORIGIN,
  PLATFORM_ORIGIN,
  PROBE_MODULE_KEY,
  effectiveModulesOf,
  readOrganizationConfig,
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
  checkByLabel,
  clickByName,
  closePage,
  factOf,
  gotoHydrated,
  openPage,
  openSiblingPage,
  signInAsOperator,
  signInWithCookies,
  waitForButton,
  waitForDialogClosed,
  waitForDialogSettled,
  waitForText,
} from "./test-support/browser-page";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "./test-support/initial-js-size";
import {
  archivePackageNamed,
  createPackage,
  extendTrial,
  grantModule,
  openTenantFromList,
  SUBMIT_IN_DIALOG,
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

async function industryDetailPath(page: Page): Promise<string> {
  await page.goto(`${PLATFORM_ORIGIN}/industry-templates`, { waitUntil: "networkidle0" });
  const href = await page.$eval(
    "a[href^='/industry-templates/']:not([href='/industry-templates/new'])",
    (anchor) => anchor.getAttribute("href"),
  );
  if (href === null) throw new Error("no industry template link on the list");
  return href;
}

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let tenantPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("আকমি মালিক");
  organizationId = await seedOrganization(owner, TENANT_SLUG, { name: TENANT_NAME });
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
    for (const key of ["tenants", "packages", "industries", "audit", "operators"]) {
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

  it("adds a support operator, who cannot open operators and loses the panel when disabled", async () => {
    const person = await seedPerson("নতুন সাপোর্ট");
    await gotoHydrated(operatorPage, "/operators", "h1");
    const ownRow = await operatorPage.evaluate((name) => {
      const row = Array.from(document.querySelectorAll("tr")).find((candidate) =>
        candidate.textContent?.includes(name),
      );
      return row?.textContent ?? "";
    }, "Platform Admin");
    expect(ownRow).toContain(banglaText("platform.operators.you"));
    expect(ownRow).not.toContain(banglaText("platform.action.disableOperator"));

    await clickByName(operatorPage, banglaText("platform.action.addOperator"));
    await waitForDialogSettled(operatorPage);
    await operatorPage.type("#operator-identifier", person.email);
    await checkByLabel(operatorPage, banglaText("platform.role.SUPPORT"));
    await operatorPage.type("#operator-reason", "সাপোর্ট হিসেবে যোগ");
    await operatorPage.click(SUBMIT_IN_DIALOG);
    await waitForDialogClosed(operatorPage);
    await waitForText(operatorPage, person.name);

    const supportPage = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await gotoHydrated(supportPage, "/sign-in", "form button[type=submit]");
    await supportPage.type("#identifier", person.email);
    await supportPage.type("#password", person.password);
    await Promise.all([
      supportPage.waitForFunction(() => window.location.pathname === "/tenants"),
      supportPage.click("form button[type=submit]"),
    ]);
    const menu = await bodyText(supportPage);
    expect(menu).toContain(banglaText("platform.nav.tenants"));
    expect(menu).toContain(banglaText("platform.nav.packages"));
    expect(menu).toContain(banglaText("platform.nav.industries"));
    expect(menu).not.toContain(banglaText("platform.nav.operators"));
    expect(menu).not.toContain(banglaText("platform.nav.audit"));
    await supportPage.goto(`${PLATFORM_ORIGIN}/operators`, { waitUntil: "networkidle0" });
    expect(await bodyText(supportPage)).toContain(banglaText("state.permissionDenied"));

    await operatorPage.bringToFront();
    await submitSheetWithReason(operatorPage, banglaText("platform.action.disableOperator"), {
      fieldId: "#operator-status-reason",
      text: "অ্যাক্সেস বন্ধ",
    });
    await waitForButton(operatorPage, banglaText("platform.action.enableOperator"));
    await supportPage.goto(`${PLATFORM_ORIGIN}/tenants`, { waitUntil: "domcontentloaded" });
    await supportPage.waitForFunction(() => window.location.pathname === "/sign-in");
    expect(new URL(supportPage.url()).pathname).toBe("/sign-in");

    await operatorPage.goto(`${PLATFORM_ORIGIN}/audit`, { waitUntil: "networkidle0" });
    const audit = await bodyText(operatorPage);
    expect(audit).toContain(banglaText("platform.audit.action.platform.operator.created"));
    expect(audit).toContain(banglaText("platform.audit.action.platform.operator.disabled"));
    await closePage(supportPage);
  });

  describe("initial JavaScript of the routes (13-UX section 11)", () => {
    const routes = (): string[] => [
      "/tenants",
      tenantPath,
      "/packages",
      "/packages/new",
      "/industry-templates",
      "/industry-templates/new",
      "/audit",
      "/operators",
      "/sign-in",
    ];

    it("stays within the budget on every route", async () => {
      const failures: string[] = [];
      const detailPath = await industryDetailPath(operatorPage);
      for (const route of [...routes(), detailPath]) {
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
    for (const route of [
      "/tenants",
      tenantPath,
      "/packages",
      "/packages/new",
      "/industry-templates",
      "/industry-templates/new",
      await industryDetailPath(page),
      "/audit",
      "/operators",
    ]) {
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
      ["industries", "/industry-templates"],
      ["industry-new", "/industry-templates/new"],
      ["industry-detail", await industryDetailPath(page)],
      ["audit", "/audit"],
      ["operators", "/operators"],
    ];
    for (const [name, path] of pages) {
      await page.goto(`${PLATFORM_ORIGIN}${path}`, { waitUntil: "networkidle0" });
      await shoot(page, name, width);
    }
    await closePage(page);
  });
});

describe("building an industry from the panel", () => {
  it("creates, publishes and assigns a copy of retail", async () => {
    const page = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await signInAsOperator(page);
    await gotoHydrated(page, "/industry-templates/new", "#template-key");
    await page.type("#template-key", "BAKERY");
    await page.type("#template-name-bn", "বেকারি");
    await page.type("#template-name-en", "Bakery");
    await page.type("#template-description-bn", "বেকারির দোকান");
    await page.type("#template-description-en", "A bakery shop");
    await page.type("#template-icon", "tag");
    const retailId = await page.evaluate(() => {
      const option = [...document.querySelectorAll("#template-clone option")].find((item) =>
        item.textContent?.includes("RETAIL"),
      );
      return option instanceof HTMLOptionElement ? option.value : "";
    });
    await page.select("#template-clone", retailId);
    await page.type("#template-reason", "বেকারি কপি");
    await page.click("form button[type=submit]");
    await page.waitForFunction(() =>
      /^\/industry-templates\/[^/]+$/.test(window.location.pathname),
    );
    const templatePath = new URL(page.url()).pathname;

    await page.click("#add-field");
    await waitForDialogSettled(page);
    await page.select("#field-entity", "member");
    await page.type("#field-key", "nid_number");
    await page.type("#field-label-bn", "এনআইডি");
    await page.type("#field-label-en", "NID");
    await page.click("#field-sensitive");
    await page.click(SUBMIT_IN_DIALOG);
    await waitForDialogClosed(page);
    await saveSection(page, "#save-fields", "এনআইডি ফিল্ড");

    await page.click("#term-offering-en", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type("#term-offering-en", "Item");
    await saveSection(page, "#save-terms", "পণ্যের ইংরেজি");

    await page.select("#setting-organization-digitScript", "BENGALI");
    await saveSection(page, "#save-settings", "বাংলা সংখ্যা");
    await page.click("#publish-template");
    await waitForDialogSettled(page);
    await page.type("#template-save-reason", "প্রকাশ");
    await page.click(SUBMIT_IN_DIALOG);
    await waitForDialogClosed(page);
    expect(await bodyText(page)).toContain(
      banglaText("platform.status.industryTemplate.PUBLISHED"),
    );

    const baker = await seedPerson("বেকারি মালিক");
    const bakeryId = await seedOrganization(baker, `bakery-${newId().slice(-8)}`, {
      name: "বেকারি ঘর",
      templateKey: "BAKERY",
    });
    const config = await readOrganizationConfig(baker, bakeryId);
    expect(config.terms["offering"]?.en).toBe("Item");
    expect(config.settings["organization.digitScript"]).toBe("BENGALI");

    await checkByLabel(page, banglaText("platform.module.sales"));
    await page.click("#save-kinds");
    await waitForDialogSettled(page);
    await page.type("#template-save-reason", "মডিউল সরানো");
    await page.click(SUBMIT_IN_DIALOG);
    await waitForText(page, "মডিউল: Sales");
    await clickByName(page, banglaText("common.cancel"));
    await waitForDialogClosed(page);

    await page.goto(`${PLATFORM_ORIGIN}${tenantPath}`, { waitUntil: "networkidle0" });
    await clickByName(page, banglaText("platform.action.changeIndustry"));
    await waitForDialogSettled(page);
    await page.select("#change-industry-template", "BAKERY");
    await page.type("#change-industry-reason", "বেকারিতে নেওয়া");
    await page.click(SUBMIT_IN_DIALOG);
    await waitForDialogClosed(page);
    expect(await bodyText(page)).toContain("BAKERY");

    const support = await seedPerson("সাপোর্ট ব্যক্তি");
    await page.goto(`${PLATFORM_ORIGIN}/operators`, { waitUntil: "networkidle0" });
    await clickByName(page, banglaText("platform.action.addOperator"));
    await waitForDialogSettled(page);
    await page.type("#operator-identifier", support.email);
    await checkByLabel(page, banglaText("platform.role.SUPPORT"));
    await page.type("#operator-reason", "সাপোর্ট হিসেবে যোগ");
    await page.click(SUBMIT_IN_DIALOG);
    await waitForDialogClosed(page);

    const supportPage = await openPage(stack.browser, DESKTOP_VIEWPORT);
    await gotoHydrated(supportPage, "/sign-in", "form button[type=submit]");
    await supportPage.type("#identifier", support.email);
    await supportPage.type("#password", support.password);
    await Promise.all([
      supportPage.waitForFunction(() => window.location.pathname === "/tenants"),
      supportPage.click("form button[type=submit]"),
    ]);
    await supportPage.goto(`${PLATFORM_ORIGIN}${templatePath}`, { waitUntil: "networkidle0" });
    const readOnly = await bodyText(supportPage);
    expect(readOnly).toContain(banglaText("platform.industry.readOnly"));
    expect(await supportPage.$("#publish-template")).toBeNull();
    await closePage(supportPage);
    await closePage(page);
  });
});

async function saveSection(page: Page, buttonId: string, reason: string): Promise<void> {
  await page.click(buttonId);
  await waitForDialogSettled(page);
  await page.type("#template-save-reason", reason);
  await page.click(SUBMIT_IN_DIALOG);
  await waitForDialogClosed(page);
}
