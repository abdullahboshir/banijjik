import { IDEMPOTENCY_KEY_HEADER } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clickButton,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForTextIn,
} from "../test-support/browser-helpers";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForHydration,
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
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let contactId: string;
const ORG_SLUG = "acme";
const REASON = "ব্রাউজার স্টোর ক্রেডিট সমন্বয়";
const PIN = "1234";

async function api(path: string, method: string, body: object): Promise<Response> {
  const response = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: ADMIN_ORIGIN,
        Cookie: owner.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
        [IDEMPOTENCY_KEY_HEADER]: newId(),
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`);
  return response;
}

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("স্টোর ক্রেডিট মালিক");
  await seedOrganization(owner, ORG_SLUG, "স্টোর ক্রেডিট ব্যবসা");
  organizationId = await organizationIdOf(owner, ORG_SLUG);
  const created = await api("/contacts", "POST", {
    contactType: "PERSON",
    name: "স্টোর ক্রেডিট গ্রাহক",
    phoneE164: "+8801712345678",
    contactRoles: ["CUSTOMER"],
  });
  const result = (await created.json()) as { data: { contactId: string } };
  contactId = result.data.contactId;
  await api("/me/approval-pin", "PUT", { currentPassword: owner.password, pin: PIN });
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

describe("dues and store credit screens", () => {
  it("an owner adjusts store credit on a contact and sees the balance and the history row", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    try {
      await signInWithCookies(page, owner);
      await gotoWhenHydrated(page, `/${ORG_SLUG}/contacts/${contactId}`, "main");
      await page.waitForSelector("#store-credit-amount");
      await waitForHydration(page, "#store-credit-amount");
      await page.type("#store-credit-amount", "25.50");
      await page.type("#store-credit-reason", REASON);
      await clickButton(page, "main button", (text) => text === message("storeCredit.save"));
      await page.waitForSelector("[role=dialog] input[inputmode=numeric]");
      await page.type("[role=dialog] input[inputmode=numeric]", PIN);
      await clickInDialog(page, message("contacts.credits.approval.submit"));
      await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
      await waitForTextIn(page, "[data-store-credit-balance]", "25.50");
      await waitForTextIn(page, "main li", REASON);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    } finally {
      await closePage(page);
    }
  }, 120_000);

  it.each(["dues", "contact"])(
    "%s stays within the 180 KiB initial script budget",
    async (route) => {
      const page = await openPage(stack.browser, PHONE_VIEWPORT);
      try {
        await signInWithCookies(page, owner);
        const path =
          route === "dues" ? `/${ORG_SLUG}/payments/dues` : `/${ORG_SLUG}/contacts/${contactId}`;
        const size = await measureInitialJs(page, path);
        process.stdout.write(`initial JS ${route}: ${toKiB(size.gzipBytes)} KiB\n`);
        expect(toKiB(size.gzipBytes), route).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
        await waitForTextIn(
          page,
          "main",
          message(route === "dues" ? "dues.title" : "storeCredit.title"),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      } finally {
        await closePage(page);
      }
    },
  );
});
