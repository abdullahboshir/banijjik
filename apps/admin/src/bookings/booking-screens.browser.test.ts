import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyText, gotoWhenHydrated, message } from "../test-support/browser-helpers";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import {
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import salonFixture from "../test-support/salon-industry-fixture.json" with { type: "json" };

let stack: BrowserStack;
let owner: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("সালমা");
  await seedOrganizationWithBody(owner, {
    name: "সালমা পার্লার",
    slug: "salon-book",
    ...salonFixture,
  });
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

describe("SALON booking calendar", () => {
  it("shows the calendar after a resource and service exist", async () => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, owner);
    await gotoWhenHydrated(page, "/salon-book/resources", "main");
    const text = await bodyText(page);
    await gotoWhenHydrated(page, "/salon-book/bookings", "main");
    const calendarText = await bodyText(page);
    await closePage(page);

    expect(text).toContain(message("resources.list.subtitle"));
    expect(calendarText).toContain(message("bookings.calendar.subtitle"));
  });
});
