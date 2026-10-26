import { PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY } from "@banijjik/contracts/payment";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clickButton,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForText,
} from "../test-support/browser-helpers";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import { publishTemplate } from "../test-support/browser-seed";
import {
  ADMIN_ORIGIN,
  API_PORT,
  callApi,
  organizationIdOf,
  seedLocation,
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  TEST_PASSWORD,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
import salonFixture from "../test-support/salon-industry-fixture.json" with { type: "json" };

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let locationId: string;
let contactId: string;
let bookingId: string;
let paymentId: string;

const SALON_SLUG = "salon-payment";
const SALON_PATH = `/${SALON_SLUG}`;

/**
 * Tomorrow 10:00 in Dhaka. "Now + 24 h" landed near Dhaka midnight on evening runs, so the
 * service ran past the 23:59 closing time and the booking was refused (3.37).
 */
function tomorrowMorningInDhaka(): string {
  const todayInDhaka = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const tomorrow = new Date(`${todayInDhaka}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return `${tomorrow.toISOString().slice(0, 10)}T10:00:00+06:00`;
}

beforeAll(async () => {
  stack = await startBrowserStack();
  await publishTemplate(stack, "SALON");
  owner = await seedPerson("সালমা মালিক");
  await seedOrganizationWithBody(owner, {
    name: "সালমা পেমেন্ট পার্লার",
    slug: SALON_SLUG,
    ...salonFixture,
  });

  organizationId = await organizationIdOf(owner, SALON_SLUG);
  await seedLocation(owner, SALON_SLUG, "মূল শাখা");

  // Create bookable service with requiresResource: false
  const offeringRes = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: owner.cookies,
    body: {
      kind: "SERVICE",
      name: "পেমেন্ট সার্ভিস",
      kindDetails: {
        durationMinutes: 30,
        requiresResource: false,
        bufferAfterMinutes: 0,
      },
      variants: [
        { name: "Default", price: { amount: 50000, currency: "BDT" }, unitKey: "SESSION" },
      ],
    },
  });
  const offeringData = (await offeringRes.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offeringData.data.offeringId}/publish`, {
    cookies: owner.cookies,
    body: { version: offeringData.data.version },
  });

  const offeringId = offeringData.data.offeringId;
  const variantId = offeringData.data.variants[0]?.variantId ?? "";

  const cookieHeader = owner.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // Read locations to get the locationId
  const locRes = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/locations`,
    {
      headers: { Cookie: cookieHeader, Origin: ADMIN_ORIGIN },
    },
  );
  const locData = (await locRes.json()) as { data: { locationId: string }[] };
  locationId = locData.data[0]?.locationId ?? "";

  // Create stylist resource serving this offering
  const weeklySchedule = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    opensAt: "00:00",
    closesAt: "23:59",
  }));
  await callApi(`/orgs/${organizationId}/resources`, {
    cookies: owner.cookies,
    body: {
      locationId,
      resourceTypeKey: "STYLIST",
      name: "স্টাইলিস্ট ১",
      capacity: 1,
      weeklySchedule,
      offeringIds: [offeringId],
    },
  });

  // Set approval PIN on owner
  await fetch(`http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/me/approval-pin`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: ADMIN_ORIGIN,
    },
    body: JSON.stringify({
      currentPassword: TEST_PASSWORD,
      pin: "1234",
    }),
  });

  // Require approval for refunds so owner's PIN is needed
  await fetch(`http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: ADMIN_ORIGIN,
    },
    body: JSON.stringify({
      items: [
        {
          settingKey: PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY,
          value: false,
        },
      ],
    }),
  });

  // Create customer contact
  const contactRes = await callApi(`/orgs/${organizationId}/contacts`, {
    cookies: owner.cookies,
    body: {
      contactType: "PERSON",
      name: "গ্রাহক রহিমা",
      phoneE164: "+8801711223344",
      contactRoles: ["CUSTOMER"],
    },
  });
  const contactData = (await contactRes.json()) as { data: { contactId: string } };
  contactId = contactData.data.contactId;

  // Create booking
  const startsAt = new Date(tomorrowMorningInDhaka()).toISOString();
  const bookingRes = await callApi(`/orgs/${organizationId}/bookings`, {
    cookies: owner.cookies,
    body: {
      offeringId,
      variantId,
      locationId,
      contactId,
      startsAt,
    },
  });
  const bookingData = (await bookingRes.json()) as { data: { bookingId: string } };
  bookingId = bookingData.data.bookingId;
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

async function receiveBkashPayment(page: Page, id: string): Promise<void> {
  await gotoWhenHydrated(page, `${SALON_PATH}/bookings/${id}`, "main");
  await waitForText(page, message("payments.status.UNPAID"));
  await clickButton(page, "button", (t) => t.includes(message("bookings.detail.receivePayment")));
  await page.waitForSelector("[role=dialog]");
  await waitForDialogSettled(page);
  await page.select("#receive-payment-method", "BKASH");
  await page.waitForSelector("#receive-payment-reference");
  await page.type("#receive-payment-reference", "TRXBKASH999");
  await clickInDialog(page, message("payments.receive.submit"));
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
  await waitForText(page, message("payments.status.PAID"));
}

async function approveRefundDialog(page: Page): Promise<void> {
  await waitForText(page, message("payments.refund.approvalTitle"));
  const pinField = await page.waitForSelector("#approval-pin");
  await pinField?.type("1234");

  const approveButtons = await page.$$("[role=dialog] button");
  for (let i = approveButtons.length - 1; i >= 0; i--) {
    const btn = approveButtons[i];
    if (!btn) continue;
    const text = (await btn.evaluate((el) => el.textContent ?? "")).trim();
    if (text === message("payments.refund.submit")) {
      await btn.click();
      break;
    }
  }
  await page.waitForFunction(() => document.querySelectorAll("[role=dialog]").length === 0);
}

describe("Payment screens flow (card 3.8 B1)", () => {
  it("receives a bKash payment on a booking, sees PAID, and refunds part of it with the owner's PIN", async () => {
    const page = await ownerPage();

    await receiveBkashPayment(page, bookingId);

    // 5. Navigate to Payments list
    await gotoWhenHydrated(page, `${SALON_PATH}/payments`, "main");
    await waitForText(page, "TRXBKASH999");

    // Click on the payment card to open detail
    const card = await page.waitForSelector("main a[data-testid='payment-card']");
    const targetHref = (await card?.evaluate((el) => el.getAttribute("href") ?? "")) ?? "";
    const pathSuffix = targetHref.split("/payments/")[1]?.split("?")[0] ?? "";
    paymentId = pathSuffix;
    await gotoWhenHydrated(page, targetHref, "main");

    await waitForText(page, "TRXBKASH999");

    // 7. Click Refund
    await clickButton(page, "button", (t) => t.includes(message("payments.detail.refund")));
    await page.waitForSelector("[role=dialog]");
    await waitForDialogSettled(page);

    // Fill reference for bKash refund
    const refInput = await page.waitForSelector("#refund-reference");
    await refInput?.type("REFUNDBKASH123");

    // Enter partial refund amount: 200
    const amountInput = await page.waitForSelector("#refund-amount");
    await page.evaluate((el) => {
      (el as HTMLInputElement).value = "";
    }, amountInput);
    await amountInput?.type("200");

    // Submit refund
    await clickInDialog(page, message("payments.refund.submit"));

    // 8. Approval PIN dialog appears & approve
    await approveRefundDialog(page);

    await closePage(page);
  }, 180_000);

  it("payments list stays within the initial JavaScript budget", async () => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, `${SALON_PATH}/payments`);
    process.stdout.write(`initial JS payments list: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), "payments list").toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it("payment detail stays within the initial JavaScript budget", async () => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, `${SALON_PATH}/payments/${paymentId}`);
    process.stdout.write(`initial JS payment detail: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);

    expect(toKiB(size.gzipBytes), "payment detail").toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });
});
