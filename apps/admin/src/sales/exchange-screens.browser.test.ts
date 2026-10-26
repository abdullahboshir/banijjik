import type { StoreCreditEntryResponse } from "@banijjik/contracts/payment";
import {
  PAYMENT_STATUS,
  type OrderResponse,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForBadge,
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
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";
import {
  ADMIN_ORIGIN,
  API_PORT,
  callApi,
  organizationIdOf,
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";

const ORG_SLUG = "exchange-shop";
const BUSINESS_NAME = "বদল ট্রেডার্স";
const EXPENSIVE_PRODUCT = "দামি চা";
const CHEAPER_PRODUCT = "সস্তা চা";
const CUSTOMER_NAME = "করিম সাহেব";
const CUSTOMER_PHONE = "+8801710000888";
/** Minor units: the paid pack is ৳40, the cheaper one ৳25, so ৳15 stays as store credit. */
const EXPENSIVE_PRICE_MINOR = 4000;
const CHEAPER_PRICE_MINOR = 2500;
const CREDIT_LEFT_MINOR = EXPENSIVE_PRICE_MINOR - CHEAPER_PRICE_MINOR;
const APPROVAL_PIN = "1234";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let locationId: string;
let expensiveOfferingId = "";
let expensiveVariantId = "";
let contactId = "";
let orderId = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, ORG_SLUG, BUSINESS_NAME);
  organizationId = await organizationIdOf(owner, ORG_SLUG);
  locationId = await firstLocationId();
  await setOwnerApprovalPin();
  const expensive = await seedProduct(EXPENSIVE_PRODUCT, EXPENSIVE_PRICE_MINOR);
  expensiveOfferingId = expensive.offeringId;
  expensiveVariantId = expensive.variantId;
  await seedProduct(CHEAPER_PRODUCT, CHEAPER_PRICE_MINOR);
  contactId = await seedCustomer();
  orderId = await completeInstantSale();
}, 240_000);

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

/** The PIN answers with no body, so the status is the whole check. */
async function setOwnerApprovalPin(): Promise<void> {
  const response = await fetch(
    `http://localhost:${API_PORT}/api/v1/orgs/${organizationId}/me/approval-pin`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerCookies(),
        Origin: ADMIN_ORIGIN,
      },
      body: JSON.stringify({ currentPassword: owner.password, pin: APPROVAL_PIN }),
    },
  );
  if (!response.ok) throw new Error(`approval PIN answered ${response.status}`);
}

/** A product without stock components: the exchange is about money and orders, not the shelf. */
async function seedProduct(
  name: string,
  priceMinor: number,
): Promise<{
  readonly offeringId: string;
  readonly variantId: string;
}> {
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: owner.cookies,
    body: {
      kind: "PRODUCT",
      name,
      kindDetails: { requiresShipping: false },
      variants: [
        {
          name: "Default",
          price: { amount: priceMinor, currency: "BDT" },
          unitKey: "PIECE",
        },
      ],
    },
  });
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: owner.cookies,
    body: { version: offering.data.version },
  });
  return {
    offeringId: offering.data.offeringId,
    variantId: offering.data.variants[0]?.variantId ?? "",
  };
}

async function seedCustomer(): Promise<string> {
  const created = await callApi(`/orgs/${organizationId}/contacts`, {
    cookies: owner.cookies,
    body: {
      contactType: "PERSON",
      name: CUSTOMER_NAME,
      phoneE164: CUSTOMER_PHONE,
      contactRoles: ["CUSTOMER"],
    },
  });
  const body = (await created.json()) as { data: { contactId: string } };
  return body.data.contactId;
}

/** The instant sale completes the order at once with one expensive pack for a known customer. */
async function completeInstantSale(): Promise<string> {
  const created = await callApi(`/orgs/${organizationId}/orders/instant`, {
    cookies: owner.cookies,
    body: {
      locationId,
      contactId,
      fulfillmentMethod: "INSTANT",
      lines: [
        {
          offeringId: expensiveOfferingId,
          variantId: expensiveVariantId,
          quantity: 1,
          modifierOptionIds: [],
        },
      ],
    },
  });
  const body = (await created.json()) as { data: { orderId: string } };
  return body.data.orderId;
}

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

/** Approves the PIN sheet when the server asks for one (a store credit refund may be exempt for an owner). */
async function approveIfAsked(page: Page): Promise<void> {
  const pinField = await page
    .waitForSelector("#approval-pin", { timeout: 4_000 })
    .catch(() => null);
  if (pinField === null) return;
  await pinField.type(APPROVAL_PIN);
  await clickByName(page, message("orders.approval.submit"));
  await page.waitForFunction(() => document.querySelector("#approval-pin") === null);
}

/** Waits until a dialog button with this text is enabled, so a click never lands on a locked step. */
async function waitForEnabledDialogButton(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("[role=dialog] button")).some(
        (button) =>
          button.textContent?.trim() === wanted && !(button as HTMLButtonElement).disabled,
      ),
    {},
    name,
  );
}

async function clickEnabledDialogButton(page: Page, name: string): Promise<void> {
  await waitForEnabledDialogButton(page, name);
  await clickInDialog(page, name);
}

/** Types into the lazy product picker of the new-items step and clicks the result row with the product's name. */
async function addNewItem(page: Page, productName: string): Promise<void> {
  await page.waitForSelector("#order-product-0", { visible: true });
  await page.type("#order-product-0", productName);
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("[role=dialog] button")).some(
        (button) => button.textContent?.includes(wanted) && button.getClientRects().length > 0,
      ),
    {},
    productName,
  );
  await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("[role=dialog] button")).find((element) =>
      element.textContent?.includes(wanted),
    );
    (button as HTMLElement | undefined)?.click();
  }, productName);
  await page.waitForSelector("#order-qty-0", { visible: true });
  await page.type("#order-qty-0", "1");
}

async function apiGetReturn(salesReturnId: string): Promise<SalesReturnResponse> {
  const body = await apiGet<{ data: SalesReturnResponse }>(
    `/orgs/${organizationId}/sales/returns/${salesReturnId}`,
  );
  return body.data;
}

async function payOrderInCash(page: Page): Promise<void> {
  await gotoWhenHydrated(page, `/${ORG_SLUG}/orders/${orderId}`, "main");
  await clickByName(page, message("orders.detail.receivePayment"));
  await waitForDialogSettled(page);
  await clickInDialog(page, message("payments.receive.submit"));
  await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
  await waitForBadge(page, message("payments.status.PAID"));
}

/** Returns the expensive pack and takes the cheaper one in its place: the difference stays as store credit. */
async function exchangeForCheaperPack(page: Page): Promise<void> {
  await clickByName(page, message("returns.exchange.open"));
  await waitForDialogSettled(page);
  await clickByName(page, message("returns.sheet.increase"));
  await page.waitForSelector("#exchange-return-reason", { visible: true });
  await page.select("#exchange-return-reason", "CHANGED_MIND");
  await clickEnabledDialogButton(page, message("returns.exchange.next"));
  await addNewItem(page, CHEAPER_PRODUCT);
  await clickEnabledDialogButton(page, message("returns.exchange.next"));
  await waitForTextIn(page, "[role=dialog]", message("returns.exchange.creditLeft"));
  await clickEnabledDialogButton(page, message("returns.exchange.submit"));
  await approveIfAsked(page);
  await waitForTextIn(page, "[role=dialog]", message("returns.exchange.resultTitle"));
}

async function exchangeReturnIdOf(): Promise<string> {
  const body = await apiGet<{ data: { salesReturnId: string }[] }>(
    `/orgs/${organizationId}/sales/returns?orderId=${orderId}&limit=10`,
  );
  const salesReturn = body.data[0];
  if (salesReturn === undefined) throw new Error("the exchange wrote no return");
  return salesReturn.salesReturnId;
}

describe("exchanges at a retail shop", () => {
  it("exchanges a paid pack for a cheaper one and sees the store credit left", async () => {
    const page = await ownerPage();
    await payOrderInCash(page);
    expect(
      (await apiGet<{ data: OrderResponse }>(`/orgs/${organizationId}/orders/${orderId}`)).data
        .paymentStatus,
    ).toBe(PAYMENT_STATUS.PAID);

    await exchangeForCheaperPack(page);
    expect(await bodyText(page)).toContain(message("returns.exchange.resultLead"));

    const salesReturn = await apiGetReturn(await exchangeReturnIdOf());
    expect(salesReturn.value).toEqual({ amount: EXPENSIVE_PRICE_MINOR, currency: "BDT" });
    expect(salesReturn.refund.amount).toEqual({ amount: EXPENSIVE_PRICE_MINOR, currency: "BDT" });
    expect(salesReturn.exchangeOrderId).not.toBeNull();

    const exchangeOrderId = salesReturn.exchangeOrderId ?? "";
    const newOrder = await apiGet<{ data: OrderResponse }>(
      `/orgs/${organizationId}/orders/${exchangeOrderId}`,
    );
    expect(newOrder.data.totals.grandTotal).toEqual({
      amount: CHEAPER_PRICE_MINOR,
      currency: "BDT",
    });
    expect(newOrder.data.paymentStatus).toBe(PAYMENT_STATUS.PAID);

    const credit = await apiGet<{ data: StoreCreditEntryResponse[] }>(
      `/orgs/${organizationId}/store-credit?contactId=${contactId}&limit=50`,
    );
    expect(credit.data.some((entry) => entry.balanceAfterMinor === CREDIT_LEFT_MINOR)).toBe(true);

    await closePage(page);
  });

  it("the order stays within the initial JavaScript budget with the exchange action", async () => {
    const page = await ownerPage();
    const size = await measureInitialJs(page, `/${ORG_SLUG}/orders/${orderId}`);
    process.stdout.write(`initial JS exchange order: ${toKiB(size.gzipBytes)} KiB\n`);
    await closePage(page);
    expect(toKiB(size.gzipBytes), "order").toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  }, 120_000);
});
