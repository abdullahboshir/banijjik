import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import type { Page } from "puppeteer-core";
import { clickByName, waitForDialogSettled, waitForHydration } from "./browser-page";
import { ADMIN_ORIGIN, TEST_PASSWORD } from "./browser-stack";

export const SUBMIT_BUTTON = "form button[type=submit]";
const DEFAULT_INVITED_ROLE = "ম্যানেজার";

/** Bangla text of a message key, from the bundled and the screen catalogs. */
export function message(messageKey: string): string {
  const found = BUNDLED_CATALOGS.bn[messageKey] ?? SCREEN_CATALOGS.bn[messageKey];
  if (found === undefined) throw new Error(`Missing Bangla message ${messageKey}`);
  return found;
}

/**
 * Like gotoHydrated, but does not wait for the network to go quiet: at desktop width the sidebar links are
 * in view and Next keeps prefetching them, so the network never rests for 500 ms.
 */
export async function gotoWhenHydrated(page: Page, path: string, selector: string): Promise<void> {
  await page.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page, selector);
}

export async function waitForPath(page: Page, path: string): Promise<void> {
  await page.waitForFunction((expected) => window.location.pathname === expected, {}, path);
}

export async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => document.body.textContent?.includes(wanted) ?? false,
    {},
    text,
  );
}

/** Waits for a status badge with exactly this text (a button label may contain the same words). */
export async function waitForBadge(page: Page, label: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("[data-tone]")).some(
        (badge) => badge.textContent === wanted,
      ),
    {},
    label,
  );
}

export async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.textContent ?? "");
}

/** Clicks the first visible button of the selector whose text passes the check. */
export async function clickButton(
  page: Page,
  selector: string,
  matches: (text: string) => boolean,
): Promise<void> {
  await page.waitForFunction((css) => document.querySelector(css) !== null, {}, selector);
  for (const button of await page.$$(selector)) {
    const text = (await button.evaluate((element) => element.textContent ?? "")).trim();
    const isVisible = await button.evaluate((element) => element.getClientRects().length > 0);
    if (isVisible && matches(text)) {
      // Centred first: a button at the bottom edge can sit under the fixed bottom navigation.
      await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await button.click();
      return;
    }
  }
  throw new Error(`No button in ${selector} matched`);
}

/** Clicks a button inside the open dialog or sheet (the same label may also be on the page behind it). */
export async function clickInDialog(page: Page, name: string): Promise<void> {
  await waitForDialogSettled(page);
  await clickButton(page, "[role=dialog] button", (text) => text === name);
}

/** Clicks the first visible list button whose text contains the given text (a card holds several texts). */
export async function clickButtonContaining(page: Page, text: string): Promise<void> {
  await clickButton(page, "main button", (buttonText) => buttonText.includes(text));
}

/** Opens the invitation sheet, creates an invitation for the email and returns the one-time link. */
export async function createInvitationThroughUi(
  page: Page,
  invitee: { identifier: string; displayName: string; roleName?: string; locationName?: string },
): Promise<string> {
  await gotoWhenHydrated(page, "/acme/settings/staff/invitations", "main button");
  await clickByName(page, message("invitations.create"));
  await waitForDialogSettled(page);
  await page.type("#invite-identifier", invitee.identifier);
  await page.type("#invite-name", invitee.displayName);
  await page.evaluate(
    (wantedRole, wantedLocation) => {
      const select = document.querySelector<HTMLSelectElement>("#invite-role-0");
      const option = Array.from(select?.options ?? []).find(
        (candidate) => candidate.textContent === wantedRole,
      );
      if (select && option) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // With two or more locations the row also needs a location: "All locations" keeps the test about the role,
      // unless the test names one location.
      const location = document.querySelector<HTMLSelectElement>("#invite-location-0");
      if (location) {
        const wanted = Array.from(location.options).find(
          (candidate) => candidate.textContent === wantedLocation,
        );
        location.value = wanted?.value ?? "ALL";
        location.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    invitee.roleName ?? DEFAULT_INVITED_ROLE,
    invitee.locationName ?? "",
  );
  await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
  await page.waitForSelector("#invite-link");
  return page.$eval("#invite-link", (input) => (input as HTMLInputElement).value);
}

/** Follows an invitation link as a new person: sign-up, then back to the invitation page. */
export async function signUpAsInvitee(
  page: Page,
  link: string,
  invitee: { name: string; email: string },
): Promise<void> {
  await page.goto(link, { waitUntil: "networkidle0" });
  await clickByName(page, message("auth.signUp.submit"));
  await waitForPath(page, "/sign-up");
  await page.waitForSelector("#name");
  await page.type("#name", invitee.name);
  await page.type("#identifier", invitee.email);
  await page.type("#password", TEST_PASSWORD);
  await page.click(SUBMIT_BUTTON);
}
