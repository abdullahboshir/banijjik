import type { HTTPResponse, Page } from "puppeteer-core";
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
import { publishTemplate, seedBookableService } from "../test-support/browser-seed";
import {
  seedLocation,
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import salonFixture from "../test-support/salon-industry-fixture.json" with { type: "json" };

let stack: BrowserStack;
let owner: SeededPerson;
let haircut: { offeringId: string; variantId: string };

const SERVICE_NAME = "হেয়ারকাট";
const STYLIST_NAME = "মিম";
const SALON_PATH = "/salon-book";

beforeAll(async () => {
  stack = await startBrowserStack();
  // The SALON seed template is a DRAFT (only RETAIL is published for signup); this stack has no platform admin.
  await publishTemplate(stack, "SALON");
  owner = await seedPerson("সালমা");
  await seedOrganizationWithBody(owner, {
    name: "সালমা পার্লার",
    slug: "salon-book",
    ...salonFixture,
  });
  await seedLocation(owner, "salon-book", "দোকান");
  haircut = await seedBookableService(owner, "salon-book", {
    name: SERVICE_NAME,
    durationMinutes: 30,
  });
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

/**
 * The next Monday as YYYY-MM-DD: the only weekday the test gives the stylist hours, always in the future.
 * The weekday comes from today's Dhaka date, not the runner's clock: CI runs in UTC, so between
 * Dhaka midnight and 06:00 the two calendars disagree and a local weekday lands on a Tuesday.
 */
function nextMonday(): string {
  const todayInDhaka = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(`${todayInDhaka}T00:00:00Z`);
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 1 ? 7 : 8 - weekday));
  return date.toISOString().slice(0, 10);
}

/** The Monday row is first: the editor lists the weekdays Monday to Sunday. */
async function setMondayHours(page: Page, opensAt: string, closesAt: string): Promise<void> {
  await page.evaluate(
    (opening, closing) => {
      const inputs = Array.from(
        document.querySelectorAll("[role=dialog] input[type=time]"),
      ) as HTMLInputElement[];
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(inputs[0] as HTMLInputElement, opening);
      inputs[0]?.dispatchEvent(new Event("input", { bubbles: true }));
      setter?.call(inputs[1] as HTMLInputElement, closing);
      inputs[1]?.dispatchEvent(new Event("input", { bubbles: true }));
    },
    opensAt,
    closesAt,
  );
}

async function tickOfferingCheckbox(page: Page, offeringName: string): Promise<void> {
  await page.evaluate((name) => {
    const label = Array.from(document.querySelectorAll("[role=dialog] label")).find(
      (element) => element.textContent?.trim() === name,
    );
    (label?.querySelector("input") as HTMLInputElement | null)?.click();
  }, offeringName);
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

/**
 * Opens the new-booking sheet from the mobile calendar and walks the steps to the slot picker:
 * the schedule of this stylist has exactly one 30-minute opening window, so the slot step shows
 * either that one button (free) or the noSlots text (taken).
 */
async function openSheetToSlotStep(page: Page, businessDate: string): Promise<void> {
  await gotoWhenHydrated(page, `${SALON_PATH}/bookings?date=${businessDate}`, "main");
  await clickButton(page, "main button", (text) => text === message("bookings.calendar.addSlot"));
  await waitForDialogSettled(page);
  await page.select("#new-booking-service", haircut.offeringId);
  await clickNext(page);
  await page.select("#new-booking-variant", haircut.variantId);
  await clickNext(page);
}

/**
 * Counts the slots the sheet really has. The noSlots text also paints while the availability
 * request is in flight, so the test watches the settled response, then the buttons it produced.
 */
async function slotCount(page: Page, businessDate: string): Promise<number> {
  // Start watching before the tap: the sheet's slot step fires availability once its selects fill.
  const answer = new Promise<Record<string, unknown> | null>((resolve) => {
    const onResponse = (response: HTTPResponse): void => {
      if (!response.url().includes("/availability")) return;
      page.off("response", onResponse);
      void (async () => {
        try {
          resolve((await response.json()) as Record<string, unknown>);
        } catch {
          resolve(null);
        }
      })();
    };
    page.on("response", onResponse);
  });
  await openSheetToSlotStep(page, businessDate);
  const json = await answer;
  if (json === null) throw new Error("the sheet never asked for availability");
  const expected: number = ((json.data as unknown[] | undefined) ?? []).length;
  // Zero is also the state before the answer paints: wait for the noSlots text there.
  await page.waitForFunction(
    (count, noSlots) => {
      const dialog = document.querySelector("[role=dialog]");
      if (dialog === null) return false;
      const buttons = dialog.querySelectorAll("fieldset li button").length;
      if (count > 0) return buttons === count;
      return buttons === 0 && (dialog.textContent ?? "").includes(noSlots);
    },
    {},
    expected,
    message("bookings.sheet.noSlots"),
  );
  return expected;
}

describe("SALON booking flow", () => {
  it("books the last free slot on the calendar, shows it, cancels it, and frees the slot again", async () => {
    const businessDate = nextMonday();
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);

    // The stylist with its one opening window, serving the bookable service.
    await gotoWhenHydrated(page, `${SALON_PATH}/resources`, "main");
    await clickByName(page, message("resources.add").replace("{term}", "স্টাইলিস্ট"));
    await waitForDialogSettled(page);
    await page.type("#resource-name", STYLIST_NAME);
    await tickOfferingCheckbox(page, SERVICE_NAME);
    await setMondayHours(page, "09:00", "09:30");
    await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
    await waitForTextIn(page, "main", STYLIST_NAME);

    // One slot exists before the booking, and booking it consumes the last one.
    expect(await slotCount(page, businessDate)).toBe(1);
    await clickButton(page, "[role=dialog] fieldset li button", () => true);
    await clickNext(page);
    await clickInDialog(page, message("form.contactLink.createNew"));
    await page.type("#new-booking-contact-new-name", "কামিনী");
    await page.type("#new-booking-contact-new-phone", "+8801710000502");
    await clickNext(page);
    await page.click(`[role=dialog] ${SUBMIT_BUTTON}`);
    await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);

    // The calendar lists the booking as a link to its detail page.
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("main a")).some((anchor) =>
        /^\/salon-book\/bookings\/[\w-]+$/.test(anchor.getAttribute("href") ?? ""),
      );
    });
    const detailHref = (await page.evaluate(() => {
      const anchor = Array.from(document.querySelectorAll("main a")).find((candidate) =>
        /^\/salon-book\/bookings\/[\w-]+$/.test(candidate.getAttribute("href") ?? ""),
      );
      return anchor?.getAttribute("href") ?? null;
    })) as string;

    // With the slot taken, the sheet now finds no free slot.
    expect(await slotCount(page, businessDate)).toBe(0);

    // Cancel from the detail page: the cancel panel disappears once the booking is cancelled.
    await gotoWhenHydrated(page, detailHref, "main");
    await page.type("main textarea", "পরীক্ষার বাতিল");
    await clickByName(page, message("bookings.action.cancel"));
    await page.waitForFunction(() => document.querySelector("main textarea") === null);

    // The slot is free again.
    expect(await slotCount(page, businessDate)).toBe(1);

    await closePage(page);
  });
});
