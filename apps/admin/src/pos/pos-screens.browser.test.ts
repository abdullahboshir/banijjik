import {
  POS_ALLOW_CREDIT_SALE_SETTING_KEY,
  POS_SESSION_STATUS,
  type PosDeviceResponse,
  type PosSessionListResponse,
  type PosZReport,
} from "@banijjik/contracts/pos";
import type { ElementHandle, Page } from "puppeteer-core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  gotoWhenHydrated,
  message,
  waitForText,
  waitForTextIn,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
import { publishTemplate } from "../test-support/browser-seed";
import {
  API_PORT,
  ADMIN_ORIGIN,
  callApi,
  organizationIdOf,
  seedOrganizationWithBody,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import salonFixture from "../test-support/salon-industry-fixture.json" with { type: "json" };

const ORG_SLUG = "till-shop";
const BUSINESS_NAME = "কাউন্টার সেলুন";
const PRODUCT_NAME = "চায়ের কাপ";
const SERVICE_NAME = "হেয়ারকাট";
const PRODUCT_PRICE_MINOR = 4000;
const SERVICE_PRICE_MINOR = 3000;
/** One haircut at ৳30 and one cup at ৳40: the bill is ৳70, paid with ৳100, so the change is ৳30. */
const BILL_MINOR = SERVICE_PRICE_MINOR + PRODUCT_PRICE_MINOR;
const CASH_RECEIVED_TEXT = "100";
const COUNTED_CASH_TEXT = "70";
/** The same budget as the other admin screens; the sheets, the close screen and the receipt load lazily. */
const POS_BUDGET_KIB = INITIAL_JS_BUDGET_KIB;
const TOUCH_TARGET_PX = 56;
const CLOSE_WAIT_MS = 20_000;
const CLOSE_POLL_MS = 500;

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let locationId: string;
let pairingCode = "";
let currentDeviceId: string | null = null;

beforeAll(async () => {
  stack = await startBrowserStack();
  await publishTemplate(stack, "SALON");
  owner = await seedPerson("রফিক ক্যাশিয়ার");
  await seedOrganizationWithBody(owner, {
    name: BUSINESS_NAME,
    slug: ORG_SLUG,
    ...salonFixture,
  });
  organizationId = await organizationIdOf(owner, ORG_SLUG);
  locationId = await firstLocationId();
  await seedProduct();
  await seedWalkInService();
  await seedCustomer();
  await setApprovalPin();
  const device = await createTillDevice();
  pairingCode = device.pairingCode;
  currentDeviceId = device.posDeviceId;
}, 240_000);

afterEach(async () => {
  if (currentDeviceId === null) return;
  const devices = await apiGet<{ data: PosDeviceResponse[] }>(
    `/orgs/${organizationId}/pos/devices?locationId=${locationId}&limit=100&page=1`,
  );
  const device = devices.data.find((item) => item.posDeviceId === currentDeviceId);
  if (device !== undefined && device.status === "ACTIVE") {
    await callApi(`/orgs/${organizationId}/pos/devices/${device.posDeviceId}/revoke`, {
      cookies: owner.cookies,
      body: { version: device.version },
    });
  }
  currentDeviceId = null;
});

afterAll(async () => {
  await stack?.stop();
});

function ownerCookies(): string {
  return owner.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`http://localhost:${API_PORT}/api/v1${path}`, {
    headers: { Cookie: ownerCookies(), Origin: ADMIN_ORIGIN },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} answered ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function firstLocationId(): Promise<string> {
  const body = await apiGet<{ data: { locationId: string }[] }>(
    `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
  );
  const location = body.data[0];
  if (location === undefined) throw new Error("the seeded business has no location");
  return location.locationId;
}

/** A plain product (no stock components): the till test is about the register and the money. */
async function seedProduct(): Promise<void> {
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: owner.cookies,
    body: {
      kind: "PRODUCT",
      name: PRODUCT_NAME,
      kindDetails: { requiresShipping: false },
      variants: [
        {
          name: "Default",
          price: { amount: PRODUCT_PRICE_MINOR, currency: "BDT" },
          unitKey: "PIECE",
        },
      ],
    },
  });
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: owner.cookies,
    body: { version: offering.data.version },
  });
}

async function seedWalkInService(): Promise<void> {
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: owner.cookies,
    body: {
      kind: "SERVICE",
      name: SERVICE_NAME,
      kindDetails: {
        durationMinutes: 30,
        requiresResource: false,
        bookingMode: "WALK_IN_ONLY",
      },
      variants: [
        {
          name: "Default",
          price: { amount: SERVICE_PRICE_MINOR, currency: "BDT" },
          unitKey: "SESSION",
        },
      ],
    },
  });
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: owner.cookies,
    body: { version: offering.data.version },
  });
}

/** The owner registers a till at the shop and gets the one-time pairing code for the browser. */
async function createTillDevice(): Promise<{
  readonly posDeviceId: string;
  readonly pairingCode: string;
}> {
  const created = await callApi(`/orgs/${organizationId}/pos/devices`, {
    cookies: owner.cookies,
    body: { locationId, name: "কাউন্টার ১" },
  });
  const body = (await created.json()) as { data: { posDeviceId: string; pairingCode: string } };
  return body.data;
}

async function seedCustomer(): Promise<string> {
  const response = await callApi(`/orgs/${organizationId}/contacts`, {
    cookies: owner.cookies,
    body: {
      contactType: "PERSON",
      name: "তিল বিক্রির গ্রাহক",
      phoneE164: "+8801712345678",
      contactRoles: ["CUSTOMER"],
    },
  });
  const body = (await response.json()) as { data: { contactId: string } };
  return body.data.contactId;
}

async function setApprovalPin(): Promise<void> {
  const response = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/me/approval-pin`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: ownerCookies(), Origin: ADMIN_ORIGIN },
      body: JSON.stringify({ currentPassword: owner.password, pin: "1234" }),
    },
  );
  if (!response.ok) throw new Error(`approval PIN answered ${response.status}`);
}

async function setCreditSaleAllowed(allowed: boolean): Promise<void> {
  const response = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/settings`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookies(), Origin: ADMIN_ORIGIN },
      body: JSON.stringify({
        items: [{ settingKey: POS_ALLOW_CREDIT_SALE_SETTING_KEY, value: allowed }],
      }),
    },
  );
  if (!response.ok) throw new Error(`setting pos.allowCreditSale answered ${response.status}`);
}

async function tillPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

/** The input under a label that contains the wanted words; waits until the sheet has rendered it. */
async function typeInLabel(page: Page, labelText: string, value: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("label")).some(
        (item) => (item.textContent ?? "").includes(wanted) && item.querySelector("input") !== null,
      ),
    { timeout: 20_000 },
    labelText,
  );
  const handle = await page.evaluateHandle((wanted) => {
    const label = Array.from(document.querySelectorAll("label")).find((item) =>
      (item.textContent ?? "").includes(wanted),
    );
    return label?.querySelector("input") ?? null;
  }, labelText);
  const input = handle.asElement() as ElementHandle<HTMLInputElement> | null;
  if (input === null) throw new Error(`no input under the label "${labelText}"`);
  await input.click({ clickCount: 3 });
  await input.type(value);
}

async function pairTill(page: Page): Promise<void> {
  await waitForText(page, message("pos.pair.title"));
  await typeInLabel(page, message("pos.pair.code"), pairingCode);
  await clickByName(page, message("pos.pair.submit"));
}

async function pairNewTill(page: Page): Promise<void> {
  await waitForText(page, message("pos.pair.title"));
  const device = await createTillDevice();
  currentDeviceId = device.posDeviceId;
  await typeInLabel(page, message("pos.pair.code"), device.pairingCode);
  await clickByName(page, message("pos.pair.submit"));
}

async function openSellingTill(): Promise<Page> {
  const page = await tillPage();
  await gotoWhenHydrated(page, `/${ORG_SLUG}/pos`, "main");
  await pairNewTill(page);
  await openRegister(page);
  return page;
}

async function clickDialogButton(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => {
      const dialog = document.querySelector('[role="alertdialog"]');
      return dialog?.textContent?.includes(wanted) ?? false;
    },
    {},
    text,
  );
  await page.evaluate((wanted) => {
    const dialog = document.querySelector('[role="alertdialog"]');
    const button = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (item) => item.textContent?.trim() === wanted,
    );
    (button as HTMLButtonElement | undefined)?.click();
  }, text);
}

async function openRegister(page: Page): Promise<void> {
  await waitForText(page, message("pos.session.openTitle"));
  await clickByName(page, message("pos.session.open"));
}

/** Searches the catalog and taps the named row. */
async function addOffering(page: Page, name: string): Promise<void> {
  const search = await page.waitForSelector(`input[type="search"]`, { visible: true });
  await search?.click({ clickCount: 3 });
  await search?.type(name);
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("button[aria-label]")).some((button) =>
        (button.getAttribute("aria-label") ?? "").includes(wanted),
      ),
    {},
    name,
  );
  await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("button[aria-label]")).find((item) =>
      (item.getAttribute("aria-label") ?? "").includes(wanted),
    );
    (button as HTMLButtonElement | undefined)?.click();
  }, name);
}

async function pickPerformer(page: Page, performerName: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("select option")).some(
        (option) => option.textContent === wanted,
      ),
    {},
    performerName,
  );
  await page.evaluate((wanted) => {
    const select = document.querySelector("select");
    if (select === null) return;
    const option = Array.from(select.options).find((item) => item.textContent === wanted);
    if (option === undefined) return;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, performerName);
}

async function paySaleInCash(page: Page): Promise<void> {
  await clickByName(page, message("pos.sale.pay"));
  await waitForText(page, message("pos.pay.title"));
  await typeInLabel(page, message("pos.pay.received"), CASH_RECEIVED_TEXT);
  await clickByName(page, message("pos.pay.confirm"));
  // The title also lives in the bundled catalog (script tags), so wait on the paper.
  await waitForTextIn(page, "article", message("pos.receipt.title"));
}

async function closeRegister(page: Page, countedCash = COUNTED_CASH_TEXT): Promise<void> {
  await clickByName(page, message("pos.sale.closeRegister"));
  await waitForText(page, message("pos.close.title"));
  await typeInLabel(page, message("pos.close.counted"), countedCash);
  await clickByName(page, message("pos.close.submit"));
  // The Z-report title also sits inside the submit button, so wait for the report-only print button.
  await waitForText(page, message("pos.z.print"));
}

/** The closed register of this till: the newest CLOSED session at this location. */
/** Polls the session list until this till's register reads CLOSED: the close answer can land a moment later. */
async function closedSessionId(): Promise<string> {
  const deadline = Date.now() + CLOSE_WAIT_MS;
  let lastListing = "";
  while (Date.now() < deadline) {
    const listed = await apiGet<{ data: PosSessionListResponse }>(
      `/orgs/${organizationId}/pos/sessions?locationId=${locationId}&limit=20`,
    );
    lastListing = JSON.stringify(listed).slice(0, 400);
    const session = listed.data.items
      .filter((item) => item.status === POS_SESSION_STATUS.CLOSED)
      .sort((left, right) => (right.closedAt ?? "").localeCompare(left.closedAt ?? ""))[0];
    if (session !== undefined) return session.posSessionId;
    await new Promise((resolve) => setTimeout(resolve, CLOSE_POLL_MS));
  }
  throw new Error(`no closed register at the shop: ${lastListing}`);
}

async function zReportOf(posSessionId: string): Promise<PosZReport> {
  const body = await apiGet<{ data: PosZReport }>(
    `/orgs/${organizationId}/pos/sessions/${posSessionId}/z-report`,
  );
  return body.data;
}

/** No sideways scroll on the phone width, and every sale-screen button is at least 56 px tall. */
async function layoutOfSaleScreen(
  page: Page,
): Promise<{ overflowsX: boolean; shortButtons: number }> {
  return page.evaluate((minimum) => {
    const overflowsX = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    const buttons = Array.from(document.querySelectorAll("main button")).filter(
      (button) => button.getClientRects().length > 0,
    );
    const shortButtons = buttons.filter(
      (button) => button.getBoundingClientRect().height < minimum,
    ).length;
    return { overflowsX, shortButtons };
  }, TOUCH_TARGET_PX);
}

describe("the till at a shop", () => {
  it("pairs the browser, opens the register, sells a service with a performer and a product for cash, prints both on the receipt and closes with the Z-report numbers", async () => {
    const page = await tillPage();
    await gotoWhenHydrated(page, `/${ORG_SLUG}/pos`, "main");
    await pairTill(page);
    await openRegister(page);
    await addOffering(page, SERVICE_NAME);
    await pickPerformer(page, owner.name);
    await addOffering(page, PRODUCT_NAME);
    expect(await bodyText(page)).toContain(message("pos.sale.total"));
    const layout = await layoutOfSaleScreen(page);
    expect(layout.overflowsX).toBe(false);
    expect(layout.shortButtons).toBe(0);
    await paySaleInCash(page);
    await waitForTextIn(page, "article", SERVICE_NAME);
    await waitForTextIn(page, "article", PRODUCT_NAME);
    await waitForTextIn(page, "article", owner.name);
    await waitForTextIn(page, "article", message("pos.pay.change"));
    await clickByName(page, message("pos.receipt.newSale"));
    await closeRegister(page);
    const report = await zReportOf(await closedSessionId());
    expect(report.salesCount).toBe(1);
    expect(report.grandTotal).toEqual({ amount: BILL_MINOR, currency: "BDT" });
    expect(report.zReportNumber).not.toBe("");
    await closePage(page);
  });

  it("stays within the first-load JavaScript budget on the till route", async () => {
    const page = await tillPage();
    const size = await measureInitialJs(page, `/${ORG_SLUG}/pos`);
    process.stdout.write(`initial JS pos: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);
    expect(toKiB(size.gzipBytes)).toBeLessThanOrEqual(POS_BUDGET_KIB);
  }, 120_000);

  it("the cashier holds a cart, starts another sale, then resumes the held cart and pays", async () => {
    const page = await openSellingTill();
    await addOffering(page, SERVICE_NAME);
    await pickPerformer(page, owner.name);
    await addOffering(page, PRODUCT_NAME);
    await clickByName(page, message("pos.sale.pay"));
    await waitForText(page, message("pos.pay.title"));
    await typeInLabel(page, message("pos.customer.phone"), "+8801712345678");
    await clickByName(page, message("pos.customer.find"));
    await clickByName(page, "তিল বিক্রির গ্রাহক");
    await clickByName(page, message("pos.pay.back"));
    await clickByName(page, message("pos.till.hold"));
    await typeInLabel(page, message("pos.till.holdLabel"), "চা");
    await clickByName(page, message("pos.till.holdSubmit"));
    await addOffering(page, SERVICE_NAME);
    await clickByName(page, message("pos.till.held"));
    await clickByName(page, message("pos.till.resume"));
    await clickDialogButton(page, message("pos.till.replaceConfirm"));
    await clickByName(page, message("pos.sale.pay"));
    await waitForText(page, "তিল বিক্রির গ্রাহক");
    await typeInLabel(page, message("pos.pay.received"), CASH_RECEIVED_TEXT);
    await clickByName(page, message("pos.pay.confirm"));
    await waitForTextIn(page, "article", message("pos.receipt.title"));
    await waitForTextIn(page, "article", PRODUCT_NAME);
    await waitForTextIn(page, "article", owner.name);
    await clickByName(page, message("pos.receipt.newSale"));
    await closeRegister(page, "40");
    await closePage(page);
  }, 120_000);

  it("a price below list asks for a manager PIN and the receipt shows the overridden price", async () => {
    const page = await openSellingTill();
    await addOffering(page, PRODUCT_NAME);
    await clickByName(page, `${message("pos.till.price")} ${PRODUCT_NAME}`);
    await typeInLabel(page, message("pos.till.unitPrice"), "20");
    await clickByName(page, message("pos.till.applyPrice"));
    await page.waitForSelector("#approval-pin", { visible: true });
    await page.type("#approval-pin", "1234");
    await clickByName(page, message("pos.till.approvalSubmit"));
    await paySaleInCash(page);
    await waitForTextIn(page, "article", "৳২০");
    await clickByName(page, message("pos.receipt.newSale"));
    await closeRegister(page, "20");
    await closePage(page);
  }, 120_000);

  it("a till return of a cash sale lowers expected cash on the Z-report", async () => {
    const page = await openSellingTill();
    await addOffering(page, PRODUCT_NAME);
    await paySaleInCash(page);
    await clickByName(page, message("pos.receipt.newSale"));
    await clickByName(page, message("pos.till.return"));
    await clickByName(page, message("pos.till.findOrder"));
    await page.waitForSelector("ul button", { visible: true });
    await page.click("ul button");
    await typeInLabel(page, message("pos.till.returnQuantity"), "1");
    await clickByName(page, message("pos.till.returnSubmit"));
    await waitForText(page, message("pos.till.returnSuccess"));
    await clickByName(page, message("pos.till.approvalClose"));
    await closeRegister(page, "0");
    const report = await zReportOf(await closedSessionId());
    expect(report.expectedCash).toEqual({ amount: 0, currency: "BDT" });
    await closePage(page);
  }, 120_000);

  it("a credit sale is refused when the setting is off", async () => {
    await setCreditSaleAllowed(false);
    const page = await openSellingTill();
    await addOffering(page, PRODUCT_NAME);
    await clickByName(page, message("pos.sale.pay"));
    await waitForText(page, message("pos.pay.title"));
    await typeInLabel(page, message("pos.customer.phone"), "+8801712345678");
    await clickByName(page, message("pos.customer.find"));
    await clickByName(page, "তিল বিক্রির গ্রাহক");
    const creditCheckbox = await page.waitForSelector('input[type="checkbox"]', { visible: true });
    await creditCheckbox?.click();
    await clickByName(page, message("pos.pay.confirm"));
    await waitForText(page, message("errors.pos_tender_required"));
    await clickByName(page, message("pos.pay.back"));
    await clickByName(page, message("pos.sale.clear"));
    await closeRegister(page, "0");
    await closePage(page);
  }, 120_000);
});
