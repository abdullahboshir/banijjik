import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SUBMIT_BUTTON,
  clickButton,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForTextIn,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import { publishTemplate, seedBookableEvent } from "../test-support/browser-seed";
import {
  seedLocation,
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
import coachingFixture from "../test-support/coaching-industry-fixture.json" with { type: "json" };

let stack: BrowserStack;
let owner: SeededPerson;
let event: { offeringId: string; variantId: string };

const EVENT_NAME = "কর্মশালা";
const SLUG = "event-book";
const SESSIONS_PATH = `/${SLUG}/bookings/event-sessions`;
const CALENDAR_PATH = `/${SLUG}/bookings`;
const CAPACITY = 5;
const SEATS = 2;

beforeAll(async () => {
  stack = await startBrowserStack();
  // The COACHING seed template (it sells EVENT) is a DRAFT; this stack has no platform admin to publish it.
  await publishTemplate(stack, "COACHING");
  owner = await seedPerson("রহিম");
  await seedOrganizationWithBody(owner, { name: "ইভেন্ট হাউস", slug: SLUG, ...coachingFixture });
  await seedLocation(owner, SLUG, "মূল শাখা");
  event = await seedBookableEvent(owner, SLUG, { name: EVENT_NAME });
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

/** A datetime-local value three days from today in Dhaka, at the given hour. */
function inThreeDays(hour: string): string {
  const todayInDhaka = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${todayInDhaka}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 3);
  return `${date.toISOString().slice(0, 10)}T${hour}:00`;
}

/** React listens to the input event: set the value through the native setter, then dispatch it. */
async function setField(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector);
  await page.evaluate(
    (css, text) => {
      const input = document.querySelector(css) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    selector,
    value,
  );
}

/** Next is disabled until the step is filled: wait for it to become clickable, then click it. */
async function clickNext(page: Page): Promise<void> {
  const wanted = message("bookings.form.next");
  await page.waitForFunction(
    (name) => {
      const button = Array.from(document.querySelectorAll("[role=dialog] button")).find(
        (element) => element.textContent?.trim() === name,
      ) as HTMLButtonElement | undefined;
      return button !== undefined && !button.disabled;
    },
    {},
    wanted,
  );
  await clickInDialog(page, wanted);
}

function seatsSoldText(sold: number): string {
  return message("bookings.eventSessions.seatsSold")
    .replace("{sold}", String(sold))
    .replace("{capacity}", String(CAPACITY));
}

async function createSession(page: Page): Promise<void> {
  await gotoWhenHydrated(page, SESSIONS_PATH, "main");
  await clickByName(page, message("bookings.eventSessions.add"));
  await waitForDialogSettled(page);
  await page.select("#session-offering", event.offeringId);
  await page.select("#session-variant", event.variantId);
  await setField(page, "#session-starts-at", inThreeDays("10:00"));
  await setField(page, "#session-ends-at", inThreeDays("12:00"));
  await setField(page, "#session-capacity", String(CAPACITY));
  await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
  await waitForTextIn(page, "main", seatsSoldText(0));
}

async function bookSeats(page: Page): Promise<void> {
  await gotoWhenHydrated(page, CALENDAR_PATH, "main");
  const addLabel = message("bookings.calendar.add").replace("{term}", "").trim();
  await clickButton(page, "main button", (text) => text.includes(addLabel));
  await waitForDialogSettled(page);
  await page.select("#new-booking-service", event.offeringId);
  await clickNext(page);
  await page.select("#new-booking-variant", event.variantId);
  await clickNext(page);
  await clickButton(page, "[role=dialog] [data-testid=new-booking-session]", () => true);
  await setField(page, "#new-booking-quantity", String(SEATS));
  // The price comes from the quote endpoint, so the sheet shows it only once the answer is in.
  await page.waitForSelector("[role=dialog] [data-testid=new-booking-price]");
  await clickNext(page);
  await clickInDialog(page, message("form.contactLink.createNew"));
  await page.type("#new-booking-contact-new-name", "করিম");
  await page.type("#new-booking-contact-new-phone", "+8801710000601");
  await clickNext(page);
  await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
}

describe("event sessions", () => {
  it("creates a session, books 2 seats, shows the seats sold and cancels the session", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);

    await createSession(page);
    await bookSeats(page);

    await gotoWhenHydrated(page, SESSIONS_PATH, "main");
    await waitForTextIn(page, "main", seatsSoldText(SEATS));

    await clickByName(page, message("bookings.eventSessions.cancel"));
    await waitForDialogSettled(page);
    const description = message("bookings.eventSessions.cancelDescription")
      .replace("{sold}", String(SEATS))
      .replace("{capacity}", String(CAPACITY));
    await waitForTextIn(page, "[role=dialog]", description);
    await clickInDialog(page, message("bookings.eventSessions.cancelConfirm"));
    await waitForTextIn(page, "main", message("bookings.eventSessions.status.CANCELLED"));

    await closePage(page);
  });

  it.each([
    ["sessions", SESSIONS_PATH],
    ["calendar", CALENDAR_PATH],
  ])("%s screen stays within the initial JavaScript budget", async (name, path) => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    const size = await measureInitialJs(page, path);
    process.stdout.write(`initial JS event ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it("has no sideways scroll on a phone", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    await gotoWhenHydrated(page, SESSIONS_PATH, "main");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await closePage(page);

    expect(overflow).toBeLessThanOrEqual(0);
  });
});
