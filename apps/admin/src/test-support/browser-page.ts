import type { Browser, Page } from "puppeteer-core";
import { ADMIN_ORIGIN, type SeededPerson } from "./browser-stack";

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
  await page.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
  await waitForHydration(page, selector);
}

/** Gives the page the session cookies the API issued, as if the person had signed in already. */
export async function signInWithCookies(page: Page, person: SeededPerson): Promise<void> {
  await page.setCookie(...person.cookies);
}

const CLICK_TARGET_ATTRIBUTE = "data-click-target";

/** Clicks the first button or link whose text or accessible name is exactly the given text. */
export async function clickByName(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (wanted, attribute) => {
      const target = Array.from(document.querySelectorAll("button, a")).find(
        (element) =>
          element.textContent?.trim() === wanted || element.getAttribute("aria-label") === wanted,
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

/**
 * Removes one cookie from every page (document) request, as if the browser never delivered it to the
 * server. Returns the paths of the page requests seen, so a test can count rounds and detect a loop.
 */
export async function stripCookieFromPageRequests(
  page: Page,
  cookieName: string,
): Promise<string[]> {
  const requestedPaths: string[] = [];
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.resourceType() !== "document") {
      void request.continue();
      return;
    }
    requestedPaths.push(new URL(request.url()).pathname);
    const kept = (request.headers()["cookie"] ?? "")
      .split("; ")
      .filter((pair) => pair !== "" && !pair.startsWith(`${cookieName}=`));
    void request.continue({ headers: { ...request.headers(), cookie: kept.join("; ") } });
  });
  return requestedPaths;
}
