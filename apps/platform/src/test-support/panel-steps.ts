import { LIMIT_KEY_VALUES } from "@banijjik/contracts";
import type { Page } from "puppeteer-core";
import { banglaText } from "./bangla-text";
import {
  checkByLabel,
  clickByName,
  clickInDialog,
  clickRowWithText,
  gotoHydrated,
  waitForButton,
  waitForDialogClosed,
  waitForDialogSettled,
  waitForHydration,
  waitForText,
  waitForToastsGone,
} from "./browser-page";

export const SUBMIT_IN_DIALOG = "[role=dialog] button[type=submit]";

/** Opens the tenant list, searches for the slug and opens the tenant; resolves to the tenant's page path. */
export async function openTenantFromList(page: Page, slug: string, name: string): Promise<string> {
  await gotoHydrated(page, "/tenants", "input[name=q]");
  await page.type("input[name=q]", slug);
  await page.waitForFunction((wanted) => window.location.search.includes(`q=${wanted}`), {}, slug);
  await waitForText(page, name);
  await clickRowWithText(page, name);
  await page.waitForFunction(() => /^\/tenants\/[^/]+$/.test(window.location.pathname));
  await waitForButton(page, banglaText("platform.action.grantModule"));
  await waitForHydration(page, "main button");
  return new URL(page.url()).pathname;
}

/** Fills the one reason field of a sheet, submits it and waits until the page has reloaded its data. */
export async function submitSheetWithReason(
  page: Page,
  actionName: string,
  reason: { fieldId: string; text: string },
): Promise<void> {
  await clickByName(page, actionName);
  await waitForDialogSettled(page);
  await page.type(reason.fieldId, reason.text);
  await page.click(SUBMIT_IN_DIALOG);
  await waitForDialogClosed(page);
}

/** Grants the module through the sheet of the tenant page. */
export async function grantModule(page: Page, moduleKey: string, reason: string): Promise<void> {
  await clickByName(page, banglaText("platform.action.grantModule"));
  await waitForDialogSettled(page);
  await page.select("#override-module", moduleKey);
  await page.type("#override-reason", reason);
  await page.click(SUBMIT_IN_DIALOG);
  await waitForDialogClosed(page);
}

/** Extends the trial through the sheet of the tenant page. */
export async function extendTrial(page: Page, days: string, reason: string): Promise<void> {
  await clickByName(page, banglaText("platform.action.extendTrial"));
  await waitForDialogSettled(page);
  await page.type("#extend-days", days);
  await page.type("#extend-reason", reason);
  await page.click(SUBMIT_IN_DIALOG);
  await waitForDialogClosed(page);
}

/** Fills the create form of a base package that holds one module, and saves it. */
export async function createPackage(
  page: Page,
  details: { packageKey: string; name: string; moduleLabel: string },
): Promise<void> {
  await gotoHydrated(page, "/packages/new", "form button[type=submit]");
  await page.type("#package-key", details.packageKey);
  await page.type("#package-name", details.name);
  await checkByLabel(page, details.moduleLabel);
  for (const limitKey of LIMIT_KEY_VALUES) await page.type(`#limit-${limitKey}`, "5");
  await page.click("form button[type=submit]");
  await page.waitForFunction(() => window.location.pathname === "/packages");
  await waitForText(page, details.name);
}

/** Opens the package from the list and archives it through the confirmation. */
export async function archivePackageNamed(page: Page, name: string): Promise<void> {
  await clickRowWithText(page, name);
  await page.waitForFunction(() => /^\/packages\/[^/]+$/.test(window.location.pathname));
  const archive = banglaText("platform.package.archive");
  await waitForButton(page, archive);
  // The button is server-rendered before it works; a click before hydration does nothing.
  await waitForHydration(page, "form button[type=submit]");
  await waitForToastsGone(page);
  await clickByName(page, archive);
  await waitForDialogSettled(page);
  await clickInDialog(page, archive);
  await page.waitForFunction(() => window.location.pathname === "/packages");
  await waitForText(page, banglaText("platform.status.package.ARCHIVED"));
}
