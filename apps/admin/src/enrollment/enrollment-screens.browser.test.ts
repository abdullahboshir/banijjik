import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENROLLMENT_REFUND_POLICY, ENROLLMENT_SETTING } from "@banijjik/contracts/enrollment";
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import {
  ADMIN_ORIGIN,
  API_PORT,
  organizationIdOf,
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import {
  bodyText,
  clickButton,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForBadge,
  waitForText,
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
import { publishTemplate, seedMember, seedMonthlyPlan } from "../test-support/browser-seed";
import gymFixture from "../test-support/gym-industry-fixture.json" with { type: "json" };
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const GYM_PATH = "/gym-fit";
const PLAN_NAME = "মাসিক প্ল্যান";
/** The GYM template's own word for an enrollment. */
const ENROLLMENT_TERM = "মেম্বারশিপ";
const MEMBER_NAME = "কামাল হোসেন";
const MEMBER_PHONE = "+8801710000777";
const EMERGENCY_PHONE = "+8801710000999";
const MINIMUM_TOUCH_TARGET = 43.5;
/** How long the worker gets to handle the payment event and activate the enrollment. */
const WORKER_ACTIVATION_WAIT_MS = 30_000;
const RELOAD_INTERVAL_MS = 500;

let stack: BrowserStack;
let owner: SeededPerson;
let detailPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  // The GYM seed template is a DRAFT; this stack has no platform admin to publish it.
  await publishTemplate(stack, "GYM");
  owner = await seedPerson("ফারুক");
  await seedOrganizationWithBody(owner, { name: "ফিট জিম", slug: "gym-fit", ...gymFixture });
  await seedMonthlyPlan(owner, "gym-fit", { name: PLAN_NAME, priceMinor: 100000 });
  await seedMember(owner, "gym-fit", {
    name: MEMBER_NAME,
    phone: MEMBER_PHONE,
    emergencyPhone: EMERGENCY_PHONE,
  });
}, 180_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

async function enrollMember(page: Page, avoidPaths: readonly string[] = []): Promise<string> {
  await gotoWhenHydrated(page, `${GYM_PATH}/enrollments`, "main");
  await clickByName(page, message("enrollment.list.add").replace("{term}", ENROLLMENT_TERM));
  await waitForDialogSettled(page);
  await page.type("#new-enrollment-contact", MEMBER_NAME);
  await clickButton(page, "[role=dialog] ul li button", (text) => text.includes(MEMBER_NAME));
  const planId = await page.$eval(
    "#new-enrollment-plan option:not([value=''])",
    (option) => (option as HTMLOptionElement).value,
  );
  await page.select("#new-enrollment-plan", planId);
  const variantId = await page.$eval(
    "#new-enrollment-variant option:not([value=''])",
    (option) => (option as HTMLOptionElement).value,
  );
  await page.select("#new-enrollment-variant", variantId);
  await clickInDialog(page, message("enrollment.sheet.save"));
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
  const pattern = /^\/gym-fit\/enrollments\/[\w-]+$/;
  // The list also holds enrollments from earlier tests; the new one is the match not seen before.
  await page.waitForFunction(
    (source, known) =>
      Array.from(document.querySelectorAll("main a")).some((anchor) => {
        const href = anchor.getAttribute("href") ?? "";
        return new RegExp(source).test(href) && !known.includes(href);
      }),
    {},
    pattern.source,
    avoidPaths,
  );
  return (await page.evaluate(
    (source, known) => {
      const anchor = Array.from(document.querySelectorAll("main a")).find((candidate) => {
        const href = candidate.getAttribute("href") ?? "";
        return new RegExp(source).test(href) && !known.includes(href);
      });
      return anchor?.getAttribute("href") ?? "";
    },
    pattern.source,
    avoidPaths,
  )) as string;
}

async function showsBadge(page: Page, label: string): Promise<boolean> {
  return page.evaluate(
    (wanted) =>
      Array.from(document.querySelectorAll("[data-tone]")).some(
        (badge) => badge.textContent === wanted,
      ),
    label,
  );
}

/**
 * Loads the page again until a status badge shows, for a change the worker makes in the
 * background. A timeout says what the page shows, so a CI failure names its cause.
 */
async function reloadUntilBadge(page: Page, path: string, label: string): Promise<void> {
  const deadline = Date.now() + WORKER_ACTIVATION_WAIT_MS;
  while (Date.now() < deadline) {
    await gotoWhenHydrated(page, path, "main");
    if (await showsBadge(page, label)) return;
    await new Promise((resolve) => setTimeout(resolve, RELOAD_INTERVAL_MS));
  }
  const shown = await page.$eval("main", (main) => main.textContent ?? "");
  throw new Error(`badge "${label}" never appeared; the page shows: ${shown.slice(0, 600)}`);
}

async function tapCheckIn(page: Page, expectedRows: number): Promise<void> {
  await clickButton(page, "main ul li button", (text) => text.includes(MEMBER_NAME));
  await clickButton(page, "main form button[type=submit]", () => true);
  await page.waitForFunction(
    (count) => document.querySelectorAll("main section ul li").length >= count,
    {},
    expectedRows,
  );
}

/**
 * Loads the page again until exactly this many period-row buttons carry the label, for a change
 * the worker makes in the background (rule 6: wait by reloading, never race the worker).
 */
async function reloadUntilButtonCount(
  page: Page,
  path: string,
  label: string,
  expected: number,
): Promise<void> {
  const deadline = Date.now() + WORKER_ACTIVATION_WAIT_MS;
  while (Date.now() < deadline) {
    await gotoWhenHydrated(page, path, "main");
    const seen = await page.evaluate(
      (wanted) =>
        Array.from(document.querySelectorAll("main ul li button")).filter((button) =>
          (button.textContent ?? "").includes(wanted),
        ).length,
      label,
    );
    if (seen === expected) return;
    await new Promise((resolve) => setTimeout(resolve, RELOAD_INTERVAL_MS));
  }
  const shown = await bodyText(page);
  throw new Error(
    `"${label}" buttons never reached ${expected}; the page shows: ${shown.slice(0, 600)}`,
  );
}

/** Receives what the one payable period asks for, then waits for the worker to settle its status. */
async function payOpenPeriod(page: Page, path: string): Promise<void> {
  await reloadUntilButtonCount(page, path, message("enrollment.detail.receivePayment"), 1);
  await clickButton(page, "main ul li button", (text) =>
    text.includes(message("enrollment.detail.receivePayment")),
  );
  await waitForDialogSettled(page);
  await clickInDialog(page, message("payments.receive.submit"));
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
  await waitForText(page, message("enrollment.detail.updating"));
  await reloadUntilButtonCount(page, path, message("enrollment.detail.receivePayment"), 0);
}

/** PATCHes one organization setting through the real API as the owner. */
async function patchOwnerSetting(
  settingKey: string,
  value: string | number | boolean,
): Promise<void> {
  const organizationId = await organizationIdOf(owner, "gym-fit");
  const cookieHeader = owner.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const response = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/settings`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader, Origin: ADMIN_ORIGIN },
      body: JSON.stringify({ items: [{ settingKey, value }] }),
    },
  );
  if (!response.ok) {
    throw new Error(`PATCH ${settingKey} answered ${response.status}: ${await response.text()}`);
  }
}

describe("GYM enrollment flow", () => {
  it("enrolls a member, refuses activation until period 1 is paid, then activates and checks in twice", async () => {
    const page = await ownerPage();
    detailPath = await enrollMember(page);

    await gotoWhenHydrated(page, detailPath, "main");
    await waitForBadge(page, message("enrollment.status.PENDING"));
    await clickByName(page, message("enrollment.action.activate"));
    await waitForText(page, message("enrollment.errors.payment_required"));

    await clickButton(page, "main button", (text) =>
      text.includes(message("enrollment.detail.receivePayment")),
    );
    await waitForDialogSettled(page);
    await clickInDialog(page, message("payments.receive.submit"));
    await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
    await waitForText(page, message("enrollment.detail.updating"));

    // The stack runs the worker (since 3.24): its payment handler activates the paid enrollment
    // (3.27 decision 7). A staff click here would race it and get a correct 409 with the stale
    // version, so the test waits for the worker instead (card 3.36). The staff path right after
    // a payment is covered by the API test "activates on a staff action right after the payment".
    await reloadUntilBadge(page, detailPath, message("enrollment.status.ACTIVE"));

    await gotoWhenHydrated(page, `${GYM_PATH}/check-ins`, "main");
    await page.type("#check-in-contact", MEMBER_NAME);
    await tapCheckIn(page, 1);
    await tapCheckIn(page, 2);

    await gotoWhenHydrated(page, detailPath, "main");
    await waitForTextIn(page, "main", `${message("enrollment.detail.sessions")}: 2`);
    await closePage(page);
  });
});

describe("GYM enrollment refund flow", () => {
  it("cancels a paid membership with two paid periods under UNUSED_PERIODS and refunds the future period to store credit", async () => {
    const page = await ownerPage();
    const refundPath = await enrollMember(page, detailPath ? [detailPath] : []);

    await gotoWhenHydrated(page, refundPath, "main");
    await waitForBadge(page, message("enrollment.status.PENDING"));
    await clickByName(page, message("enrollment.action.activate"));
    await waitForText(page, message("enrollment.errors.payment_required"));

    // Period 1 starts today and runs.
    await payOpenPeriod(page, refundPath);
    await reloadUntilBadge(page, refundPath, message("enrollment.status.ACTIVE"));

    // Renewing inside the running period adds period 2, which starts after today.
    await gotoWhenHydrated(page, refundPath, "main");
    await clickByName(page, message("enrollment.action.renew"));
    await payOpenPeriod(page, refundPath);

    await patchOwnerSetting(
      ENROLLMENT_SETTING.REFUND_POLICY,
      ENROLLMENT_REFUND_POLICY.UNUSED_PERIODS,
    );

    await gotoWhenHydrated(page, refundPath, "main");
    await clickByName(page, message("enrollment.action.cancel"));
    await waitForDialogSettled(page);
    // The cancel response is watched, so a failure names the API's answer, not just the page.
    const cancelResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/cancel"),
    );
    await clickInDialog(page, message("enrollment.cancel.confirm"));
    const cancelled = (await (await cancelResponse).json()) as {
      data?: Record<string, unknown>;
    };
    process.stdout.write(
      `cancel refundableByPeriod: ${JSON.stringify(cancelled.data?.refundableByPeriod)}\n`,
    );
    await waitForText(page, message("enrollment.cancel.refundablePeriods"));
    // One refundable row: the future period; the one already running is not refundable.
    // The row list renders with the response, so the count is polled instead of read once.
    let refundableRows = 0;
    const rowsDeadline = Date.now() + WORKER_ACTIVATION_WAIT_MS;
    while (refundableRows !== 1 && Date.now() < rowsDeadline) {
      refundableRows = await page.evaluate(
        () => document.querySelectorAll("main [role=status] ul li").length,
      );
      if (refundableRows !== 1) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(refundableRows, `cancel data: ${JSON.stringify(cancelled.data)}`).toBe(1);

    await clickByName(page, message("enrollment.cancel.close"));
    await reloadUntilBadge(page, refundPath, message("enrollment.status.CANCELLED"));

    // A refund button on the future period only; the used period has no limit left to refund.
    await reloadUntilButtonCount(page, refundPath, message("enrollment.detail.refund"), 1);
    await clickButton(page, "main ul li button", (text) =>
      text.includes(message("enrollment.detail.refund")),
    );
    await waitForDialogSettled(page);
    await page.select("#refund-method", PAYMENT_METHOD.STORE_CREDIT);
    await clickInDialog(page, message("payments.refund.submit"));
    await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);

    // The refund spent the period's limit, so no refund button is left after the worker settles.
    await reloadUntilButtonCount(page, refundPath, message("enrollment.detail.refund"), 0);
    await closePage(page);
  }, 240_000);
});

describe("the phone and the first load", () => {
  const routes = [
    ["list", () => `${GYM_PATH}/enrollments`],
    ["detail", () => detailPath],
    ["check-ins", () => `${GYM_PATH}/check-ins`],
  ] as const;

  it.each(routes)("%s stays within the initial JavaScript budget", async (name, path) => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, path());
    process.stdout.write(`initial JS enrollment ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);
    expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });

  it.each(routes)("%s has no sideways scroll and touch targets of 44 px", async (name, path) => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, path(), "main");
    expect(await bodyText(page)).not.toBe("");
    const report = await page.evaluate((minimum) => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const small = Array.from(
        document.querySelectorAll("main button, main a, main select, main input"),
      )
        .filter((control) => control.getClientRects().length > 0)
        .filter((control) => (control as HTMLInputElement).type !== "checkbox")
        .filter((control) => control.getBoundingClientRect().height < minimum)
        .map((control) => `${control.tagName} ${control.textContent?.trim().slice(0, 20)}`);
      return { overflow, small };
    }, MINIMUM_TOUCH_TARGET);
    await closePage(page);
    expect(report.overflow, name).toBeLessThanOrEqual(0);
    expect(report.small, name).toEqual([]);
  });
});
