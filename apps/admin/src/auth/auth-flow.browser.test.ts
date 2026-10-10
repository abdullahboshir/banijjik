import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_ORIGIN,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  TEST_PASSWORD,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import {
  clickByName,
  closePage,
  gotoHydrated,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  stripCookieFromPageRequests,
  waitForDialogSettled,
  waitForHydration,
} from "../test-support/browser-page";

const text = BUNDLED_CATALOGS.bn;
const SUBMIT_BUTTON = "form button[type=submit]";
const NAME_OF_ACME = "আকমি ট্রেডার্স";
const NAME_OF_BETA = "বিটা স্টোর";

function message(messageKey: string): string {
  const found = text[messageKey];
  if (found === undefined) throw new Error(`Missing Bangla message ${messageKey}`);
  return found;
}

let stack: BrowserStack;
let person: SeededPerson;

async function waitForPath(page: Page, path: string): Promise<void> {
  await page.waitForFunction((expected) => window.location.pathname === expected, {}, path);
}

async function readText(page: Page, selector: string): Promise<string> {
  await page.waitForSelector(selector);
  return page.$eval(selector, (element) => element.textContent ?? "");
}

async function signInThroughForm(page: Page, identifier: string, password: string): Promise<void> {
  await page.type("#identifier", identifier);
  await page.type("#password", password);
  await page.click(SUBMIT_BUTTON);
}

async function openAccountMenu(page: Page): Promise<void> {
  await clickByName(page, message("shell.account"));
  await waitForDialogSettled(page);
}

beforeAll(async () => {
  stack = await startBrowserStack();
  person = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(person, "acme", NAME_OF_ACME);
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

describe("sign up and sign out at 375 px in Bangla", () => {
  it("signs up, lands on the empty business list, and signs out", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await gotoHydrated(page, "/sign-up", SUBMIT_BUTTON);
    await page.type("#name", "করিমা বেগম");
    await page.type("#identifier", `karima-${Date.now()}@example.com`);
    await page.type("#password", TEST_PASSWORD);
    await page.click(SUBMIT_BUTTON);

    await page.waitForFunction(
      (empty) => document.body.textContent?.includes(empty) ?? false,
      {},
      message("orgs.empty"),
    );
    await openAccountMenu(page);
    await clickByName(page, message("account.signOut"));
    await waitForPath(page, "/sign-in");
    const cookieNames = (await page.cookies(ADMIN_ORIGIN)).map((cookie) => cookie.name);
    await closePage(page);
    expect(cookieNames).not.toContain("access_token");
  });

  it("shows the wrong-credentials message and stays on the sign-in page", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await gotoHydrated(page, "/sign-in", SUBMIT_BUTTON);
    await signInThroughForm(page, person.email, "not-the-password");
    const alert = await readText(page, "form [role=alert]");
    const path = await page.evaluate(() => window.location.pathname);
    await closePage(page);
    expect(alert).toBe(message("errors.invalid_credentials"));
    expect(path).toBe("/sign-in");
  });

  it("does not follow a next address that points to another site", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await gotoHydrated(page, "/sign-in?next=%2F%2Fevil.com", SUBMIT_BUTTON);
    await signInThroughForm(page, person.email, person.password);
    await waitForPath(page, "/acme");
    const host = await page.evaluate(() => window.location.host);
    await closePage(page);
    expect(host).toBe(new URL(ADMIN_ORIGIN).host);
  });
});

describe("protected pages and session renewal", () => {
  it("sends a person without a session to sign-in and back to the page after signing in", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await page.goto(`${ADMIN_ORIGIN}/acme`, { waitUntil: "networkidle0" });
    await waitForPath(page, "/sign-in");
    const nextParameter = await page.evaluate(() =>
      new URLSearchParams(location.search).get("next"),
    );
    await waitForHydration(page, SUBMIT_BUTTON);
    await signInThroughForm(page, person.email, person.password);
    await waitForPath(page, "/acme");
    const businessName = await readText(page, "header span.truncate");
    await closePage(page);
    expect(nextParameter).toBe("/acme");
    expect(businessName).toBe(NAME_OF_ACME);
  });

  it("renews an expired access cookie silently and returns to the same page", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    await page.deleteCookie({ name: "access_token", domain: "localhost", path: "/" });
    await page.goto(`${ADMIN_ORIGIN}/acme`, { waitUntil: "networkidle0" });
    await waitForPath(page, "/acme");
    const businessName = await readText(page, "header span.truncate");
    const cookieNames = (await page.cookies(ADMIN_ORIGIN)).map((cookie) => cookie.name);
    await closePage(page);
    expect(businessName).toBe(NAME_OF_ACME);
    expect(cookieNames).toContain("access_token");
  });
});

describe("a browser that never delivers the access cookie", () => {
  it("ends on sign-in with an explanation after one renewal round, without looping", async () => {
    // A person of their own: the renewal test above already rotated the refresh token of the shared one.
    const renewable = await seedPerson("সালমা খাতুন");
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, renewable);
    const requestedPaths = await stripCookieFromPageRequests(page, "access_token");
    await page.goto(`${ADMIN_ORIGIN}/acme`, { waitUntil: "networkidle0" });
    await waitForPath(page, "/sign-in");
    await waitForHydration(page, SUBMIT_BUTTON);
    const alert = await readText(page, "main > [role=alert]");
    const reason = await page.evaluate(() => new URLSearchParams(location.search).get("reason"));
    const cookieNames = (await page.cookies(ADMIN_ORIGIN)).map((cookie) => cookie.name);
    await closePage(page);
    expect(alert).toBe(message("auth.session_unavailable"));
    expect(reason).toBe("session");
    expect(requestedPaths.filter((path) => path === "/session")).toHaveLength(1);
    expect(cookieNames).not.toContain("session_renewed");
  });
});

describe("the rate limit of sign-in across origins", () => {
  it("shows how long to wait, read from the Retry-After header of the API", async () => {
    const attemptsBeforeLimit = 5;
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await gotoHydrated(page, "/sign-in", SUBMIT_BUTTON);
    await page.type("#identifier", `nobody-${Date.now()}@example.com`);
    await page.type("#password", "not-the-password");
    for (let attempt = 0; attempt <= attemptsBeforeLimit; attempt += 1) {
      await page.click(SUBMIT_BUTTON);
      // The button is busy while the request runs; a click on a busy button would not count as an attempt.
      await page.waitForSelector(`${SUBMIT_BUTTON}:not([aria-busy=true]):not([disabled])`);
    }
    // The wait is whatever the limiter reports; the point is that the number came from the Retry-After header.
    const [before, after] = message("auth.rateLimited").split("{minutes}");
    await page.waitForFunction(
      (start, end) => {
        const shown = document.querySelector("form [role=alert]")?.textContent ?? "";
        return shown.startsWith(start) && shown.endsWith(end);
      },
      {},
      before ?? "",
      after ?? "",
    );
    await closePage(page);
  });
});

describe("the shell with real data", () => {
  it("shows the business name, the account menu and an unknown business as not found", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    await gotoHydrated(page, "/acme", "header button");
    const businessName = await readText(page, "header span.truncate");
    await page.goto(`${ADMIN_ORIGIN}/no-such-business`, { waitUntil: "networkidle0" });
    const notFound = await readText(page, "main");
    await closePage(page);
    expect(businessName).toBe(NAME_OF_ACME);
    expect(notFound).toContain(message("errors.not_found"));
  });

  it("switches business with a full page load while navigation inside a business keeps the shell", async () => {
    await seedOrganization(person, "beta", NAME_OF_BETA);
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    await gotoHydrated(page, "/acme?probe=1", "header button");

    await page.evaluate(() => {
      Reflect.set(document.querySelector("header") ?? {}, "shellProbe", true);
      Reflect.set(window, "pageProbe", true);
    });
    await clickByName(page, message("nav.home"));
    await page.waitForFunction(() => window.location.search === "");
    const shellKept = await page.evaluate(
      () => Reflect.get(document.querySelector("header") ?? {}, "shellProbe") === true,
    );

    await openAccountMenu(page);
    const currentMarked = await page.$eval(
      "[role=dialog] a[aria-current=true]",
      (a) => a.textContent,
    );
    await clickByName(page, NAME_OF_BETA);
    await waitForPath(page, "/beta");
    const pageProbe = await page.evaluate(() => Reflect.get(window, "pageProbe"));
    const businessName = await readText(page, "header span.truncate");
    await closePage(page);

    expect(shellKept).toBe(true);
    expect(currentMarked).toBe(NAME_OF_ACME);
    expect(pageProbe).toBeUndefined();
    expect(businessName).toBe(NAME_OF_BETA);
  });

  it("switches the language from the account menu and keeps it after a reload", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    await gotoHydrated(page, "/acme", "header button");
    await openAccountMenu(page);
    await clickByName(page, BUNDLED_CATALOGS.en["language.en"] ?? "");
    await page.waitForFunction(() => document.documentElement.lang === "en");
    await page.reload({ waitUntil: "networkidle0" });
    const language = await page.evaluate(() => document.documentElement.lang);
    await closePage(page);
    expect(language).toBe("en");
  });
});
