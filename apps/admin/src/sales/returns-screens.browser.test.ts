import {
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SALES_RETURN_STATUS,
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
  waitForText,
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

const ORG_SLUG = "returns-shop";
const BUSINESS_NAME = "ফেরত ট্রেডার্স";
const PRODUCT_NAME = "চায়ের প্যাকেট";
const CUSTOMER_NAME = "করিম সাহেব";
const CUSTOMER_PHONE = "+8801710000777";
/** Minor units: ৳40 a pack. Two packs are sold; one comes back in cash. */
const PACK_PRICE_MINOR = 4000;
const SOLD_QUANTITY = 2;
const APPROVAL_PIN = "1234";
const ORDER_TOTAL_MINOR = PACK_PRICE_MINOR * SOLD_QUANTITY;
const RETURN_PATH_PATTERN = "^/[a-z0-9-]+/returns/[0-9a-f-]{36}$";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let locationId: string;
let productOfferingId = "";
let productVariantId = "";
let contactId = "";
let orderId = "";
let returnedSalesReturnId = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, ORG_SLUG, BUSINESS_NAME);
  organizationId = await organizationIdOf(owner, ORG_SLUG);
  locationId = await firstLocationId();
  await setOwnerApprovalPin();
  await seedProduct();
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

/** A product without stock components: the return test is about money and the order, not the shelf. */
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
          price: { amount: PACK_PRICE_MINOR, currency: "BDT" },
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
  productOfferingId = offering.data.offeringId;
  productVariantId = offering.data.variants[0]?.variantId ?? "";
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

/** The instant sale completes the order at once; the test pays it through the receive sheet. */
async function completeInstantSale(): Promise<string> {
  const created = await callApi(`/orgs/${organizationId}/orders/instant`, {
    cookies: owner.cookies,
    body: {
      locationId,
      contactId,
      fulfillmentMethod: "INSTANT",
      lines: [
        {
          offeringId: productOfferingId,
          variantId: productVariantId,
          quantity: SOLD_QUANTITY,
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

/** Approves the PIN sheet when the server asks for one (a refund may be exempt for an owner). */
async function approveIfAsked(page: Page): Promise<void> {
  const pinField = await page
    .waitForSelector("#approval-pin", { timeout: 4_000 })
    .catch(() => null);
  if (pinField === null) return;
  await pinField.type(APPROVAL_PIN);
  await clickByName(page, message("orders.approval.submit"));
  await page.waitForFunction(() => document.querySelector("#approval-pin") === null);
}

async function clickLabelledCheckbox(page: Page, text: string): Promise<void> {
  await page.evaluate((wanted) => {
    const label = Array.from(document.querySelectorAll("[role=dialog] label")).find((item) =>
      (item.textContent ?? "").includes(wanted),
    );
    label?.querySelector("input")?.click();
  }, text);
}

async function apiGetReturn(salesReturnId: string): Promise<SalesReturnResponse> {
  const body = await apiGet<{ data: SalesReturnResponse }>(
    `/orgs/${organizationId}/sales/returns/${salesReturnId}`,
  );
  return body.data;
}

async function apiGetOrder(): Promise<OrderResponse> {
  const body = await apiGet<{ data: OrderResponse }>(`/orgs/${organizationId}/orders/${orderId}`);
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

async function returnOneUnitInCash(page: Page): Promise<string> {
  await clickByName(page, message("returns.sheet.open"));
  await waitForDialogSettled(page);
  await clickByName(page, message("returns.sheet.increase"));
  await page.waitForSelector("#return-reason", { visible: true });
  await page.select("#return-reason", "CHANGED_MIND");
  await page.waitForSelector("#return-refund-method", { visible: true });
  await page.select("#return-refund-method", "CASH");
  await clickInDialog(page, message("returns.sheet.submit"));
  await approveIfAsked(page);
  await page.waitForFunction(
    (pattern) => new RegExp(pattern, "u").test(window.location.pathname),
    {},
    RETURN_PATH_PATTERN,
  );
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
}

async function reverseReturnWithPayback(page: Page): Promise<void> {
  await clickByName(page, message("returns.reverse.open"));
  await waitForDialogSettled(page);
  await page.select("#reverse-reason", "CUSTOMER_TOOK_GOODS_BACK");
  await clickLabelledCheckbox(page, message("returns.reverse.payback"));
  await page.waitForSelector("#reverse-payback-method", { visible: true });
  await page.select("#reverse-payback-method", "CASH");
  await clickInDialog(page, message("returns.reverse.submit"));
  await page.waitForSelector("#approval-pin", { visible: true });
  await approveIfAsked(page);
}

describe("returns at a retail shop", () => {
  it("returns one unit of a paid order in cash, sees the refund, then reverses it with payback", async () => {
    const page = await ownerPage();
    await payOrderInCash(page);
    expect((await apiGetOrder()).paymentStatus).toBe(PAYMENT_STATUS.PAID);

    const salesReturnId = await returnOneUnitInCash(page);
    returnedSalesReturnId = salesReturnId;
    await waitForText(page, message("returns.detail.title"));
    const afterReturn = await apiGetReturn(salesReturnId);
    expect(afterReturn.status).toBe(SALES_RETURN_STATUS.ACTIVE);
    expect(afterReturn.value).toEqual({ amount: PACK_PRICE_MINOR, currency: "BDT" });
    expect(afterReturn.refund.amount).toEqual({ amount: PACK_PRICE_MINOR, currency: "BDT" });
    expect((await apiGetOrder()).totals.grandTotal.amount).toBe(
      ORDER_TOTAL_MINOR - PACK_PRICE_MINOR,
    );
    expect(await bodyText(page)).toContain(message("returns.detail.refund"));

    await reverseReturnWithPayback(page);
    await waitForText(page, message("returns.status.REVERSED"));

    const reversed = await apiGetReturn(salesReturnId);
    expect(reversed.status).toBe(SALES_RETURN_STATUS.REVERSED);
    expect(reversed.reversal?.paybackPaymentId).not.toBeNull();
    const restored = await apiGetOrder();
    expect(restored.totals.grandTotal.amount).toBe(ORDER_TOTAL_MINOR);
    expect(restored.returnStatus).toBe(ORDER_RETURN_STATUS.NONE);
    expect(restored.status).toBe(ORDER_STATUS.COMPLETED);

    await closePage(page);
  });

  it.each([
    ["list", () => `/${ORG_SLUG}/returns`],
    ["detail", () => `/${ORG_SLUG}/returns/${returnedSalesReturnId}`],
    ["order", () => `/${ORG_SLUG}/orders/${orderId}`],
  ])(
    "%s stays within the initial JavaScript budget",
    async (name, path) => {
      const page = await ownerPage();
      const size = await measureInitialJs(page, path());
      process.stdout.write(`initial JS returns ${name}: ${toKiB(size.gzipBytes)} KiB
`);
      await closePage(page);
      expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    },
    120_000,
  );
});
