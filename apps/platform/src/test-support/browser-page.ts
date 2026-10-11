import type { Browser, Page } from "puppeteer-core";
import {
  OPERATOR_EMAIL,
  OPERATOR_PASSWORD,
  PLATFORM_ORIGIN,
  type SeededPerson,
} from "./browser-stack";

export const PHONE_VIEWPORT = { width: 375, height: 812, isMobile: true, hasTouch: true } as const;
export const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;

/** A page in its own browser context, so cookies of one test never reach another. Close it with closePage. */
export async function openPage(
  browser: Browser,
  viewport: { width: number; height: number },
): Promise<Page> {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  return page;
}

/** A second page in the browser context of `page`: it shares the cookies, as two tabs of one person do. */
export async function openSiblingPage(page: Page): Promise<Page> {
  const sibling = await page.browserContext().newPage();
  await sibling.setViewport(DESKTOP_VIEWPORT);
  return sibling;
}

export async function closePage(page: Page): Promise<void> {
  await page.browserContext().close();
}

/** Waits until a sheet or dialog has finished sliding in, so a click lands where the button really is. */
export async function waitForDialogSettled(page: Page): Promise<void> {
  await page.waitForSelector("[role=dialog]");
  await page.waitForFunction(
    () => (document.querySelector("[role=dialog]")?.getAnimations().length ?? 1) === 0,
  );
}

/** Waits until the dialog is gone, which is when a write has finished and the page has reloaded its data. */
export async function waitForDialogClosed(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
}

/** React puts a __reactProps key on an element once it is hydrated; a click before that does nothing. */
export async function waitForHydration(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(
    (cssSelector) => {
      const element = document.querySelector(cssSelector);
      return element !== null && Object.keys(element).some((key) => key.startsWith("__reactProps"));
    },
    {},
    selector,
  );
}

export async function gotoHydrated(page: Page, path: string, selector: string): Promise<void> {
  await page.goto(`${PLATFORM_ORIGIN}${path}`, { waitUntil: "networkidle0" });
  await waitForHydration(page, selector);
}

export async function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

export async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction((wanted) => document.body.innerText.includes(wanted), {}, text);
}

/** Gives the page the session cookies the API issued, as if the person had signed in already. */
export async function signInWithCookies(page: Page, person: SeededPerson): Promise<void> {
  await page.setCookie(...person.cookies);
}

const CLICK_TARGET_ATTRIBUTE = "data-click-target";

/** Clicks the first visible button or link whose text or accessible name is exactly the given text. */
export async function clickByName(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (wanted, attribute) => {
      const target = Array.from(document.querySelectorAll("button, a")).find(
        (element) =>
          (element.textContent?.trim() === wanted ||
            element.getAttribute("aria-label") === wanted) &&
          element.getClientRects().length > 0,
      );
      target?.setAttribute(attribute, "true");
      return target !== undefined;
    },
    {},
    name,
    CLICK_TARGET_ATTRIBUTE,
  );
  // A real click: it fails when something else covers the element, which a scripted click would not notice.
  await page.click(`[${CLICK_TARGET_ATTRIBUTE}]`);
  // The click may have replaced the element (navigation), so a missing marker is fine.
  await page.evaluate((attribute) => {
    document.querySelector(`[${attribute}]`)?.removeAttribute(attribute);
  }, CLICK_TARGET_ATTRIBUTE);
}

/** Ticks the checkbox whose label text is exactly the given text. */
export async function checkByLabel(page: Page, label: string): Promise<void> {
  const isMarked = await page.evaluate(
    (wanted, attribute) => {
      const found = Array.from(document.querySelectorAll("label")).find(
        (candidate) => candidate.textContent?.trim() === wanted,
      );
      const input = found?.querySelector("input[type=checkbox]");
      input?.setAttribute(attribute, "true");
      return input !== null && input !== undefined;
    },
    label,
    CLICK_TARGET_ATTRIBUTE,
  );
  if (!isMarked) throw new Error(`No checkbox labelled ${label}`);
  await page.click(`[${CLICK_TARGET_ATTRIBUTE}]`);
  await page.evaluate((attribute) => {
    document.querySelector(`[${attribute}]`)?.removeAttribute(attribute);
  }, CLICK_TARGET_ATTRIBUTE);
}

/** Signs in on the platform sign-in page with the seeded super admin and waits for the first page. */
export async function signInAsOperator(page: Page): Promise<void> {
  await gotoHydrated(page, "/sign-in", "form button[type=submit]");
  await page.type("#identifier", OPERATOR_EMAIL);
  await page.type("#password", OPERATOR_PASSWORD);
  await Promise.all([
    page.waitForFunction(() => window.location.pathname === "/tenants"),
    page.click("form button[type=submit]"),
  ]);
  await page.waitForNetworkIdle();
}

const ROW_TARGET_ATTRIBUTE = "data-row-target";

/** Clicks the visible table row or card button that contains the text (a list row opens its record). */
export async function clickRowWithText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted, attribute) => {
      const target = Array.from(document.querySelectorAll("tr, li button")).find(
        (element) =>
          element.textContent?.includes(wanted) === true && element.getClientRects().length > 0,
      );
      target?.setAttribute(attribute, "true");
      return target !== undefined;
    },
    {},
    text,
    ROW_TARGET_ATTRIBUTE,
  );
  await page.click(`[${ROW_TARGET_ATTRIBUTE}]`);
}

/** Waits until a visible button or link with exactly this text exists. */
export async function waitForButton(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("button, a")).some(
        (element) => element.textContent?.trim() === wanted && element.getClientRects().length > 0,
      ),
    {},
    name,
  );
}

/** Clicks the button with exactly this text inside the open dialog. */
export async function clickInDialog(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (wanted, attribute) => {
      const dialog = document.querySelector("[role=dialog]");
      const target = Array.from(dialog?.querySelectorAll("button") ?? []).find(
        (element) => element.textContent?.trim() === wanted,
      );
      target?.setAttribute(attribute, "true");
      return target !== undefined;
    },
    {},
    name,
    ROW_TARGET_ATTRIBUTE,
  );
  await page.click(`[${ROW_TARGET_ATTRIBUTE}]`);
}

/** The text next to a term in a description list (the facts of a detail page). */
export async function factOf(page: Page, term: string): Promise<string> {
  return page.evaluate((wanted) => {
    const label = Array.from(document.querySelectorAll("dt")).find(
      (element) => element.textContent?.trim() === wanted,
    );
    return label?.nextElementSibling?.textContent?.trim() ?? "";
  }, term);
}

/** A toast sits over the bottom of the page for a few seconds; a click on a button under it would hit the toast. */
export async function waitForToastsGone(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector("[data-sonner-toast]") === null, {
    timeout: 15_000,
  });
}
