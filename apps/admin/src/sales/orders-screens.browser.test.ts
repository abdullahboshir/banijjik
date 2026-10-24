import type { InventoryLevelRow } from "@banijjik/contracts/inventory";
import { ORDER_STATUS, PAYMENT_STATUS, type OrderResponse } from "@banijjik/contracts/sales";
import { formatMoney } from "@banijjik/ui";
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
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const ORG_SLUG = "orders-shop";
const BUSINESS_NAME = "আকমি ট্রেডার্স";
const RICE_ITEM = "চাল";
const SUGAR_ITEM = "চিনি";
const RICE_PRODUCT = "চালের ব্যাগ";
const SUGAR_PRODUCT = "চিনির প্যাকেট";
/** Prices are minor units: ৳50 and ৳30. */
const RICE_UNIT_MINOR = 5000;
const SUGAR_UNIT_MINOR = 3000;
const RICE_GRAMS_PER_BAG = 1000;
const SUGAR_GRAMS_PER_PACK = 500;
const RECEIVED_GRAMS = 10_000;
const ORDER_TOTAL_MINOR = RICE_UNIT_MINOR * 2 + SUGAR_UNIT_MINOR;
const MINIMUM_TOUCH_TARGET = 43.5;
const FIRST_ORDER_NUMBER = "000001";
const BUYER_NAME = "করিম সাহেব";
const SECOND_ORDER_NUMBER = "000002";

let stack: BrowserStack;
let owner: SeededPerson;
let organizationId: string;
let locationId: string;
let riceItemId: string;
let sugarItemId: string;
let orderDetailPath = "";
let draftDetailPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, ORG_SLUG, BUSINESS_NAME);
  organizationId = await organizationIdOf(owner, ORG_SLUG);
  locationId = await firstLocationId();

  await createItemsAndReceiveStockThroughUi();
  riceItemId = await inventoryItemIdOf(RICE_ITEM);
  sugarItemId = await inventoryItemIdOf(SUGAR_ITEM);
  const rice = await seedProduct(RICE_PRODUCT, RICE_UNIT_MINOR, riceItemId, RICE_GRAMS_PER_BAG);
  await seedProduct(SUGAR_PRODUCT, SUGAR_UNIT_MINOR, sugarItemId, SUGAR_GRAMS_PER_PACK);

  // A draft stays open for the detail route checks: it keeps every action button on the page.
  const draft = await callApi(`/orgs/${organizationId}/orders`, {
    cookies: owner.cookies,
    body: {
      locationId,
      fulfillmentMethod: "PICKUP",
      lines: [
        {
          offeringId: rice.offeringId,
          variantId: rice.variantId,
          quantity: 1,
          modifierOptionIds: [],
        },
      ],
    },
  });
  const draftBody = (await draft.json()) as { data: { orderId: string } };
  draftDetailPath = `/${ORG_SLUG}/orders/${draftBody.data.orderId}`;
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

async function ownerPage(): Promise<Page> {
  const page = await openPage(stack.browser, PHONE_VIEWPORT);
  await signInWithCookies(page, owner);
  return page;
}

async function typeInto(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.type(selector, text);
}

/** Creates a stock item from the 3.3 screens; the receive sheet needs an item to receive into. */
async function createStockItem(page: Page, name: string): Promise<void> {
  await clickByName(page, message("stock.item.create"));
  await waitForDialogSettled(page);
  await typeInto(page, "#item-name", name);
  await page.select("#item-unit", "GRAM");
  await clickByName(page, message("stock.item.createSubmit"));
  await page.waitForSelector("[role=dialog]", { hidden: true });
}

/** Receives stock of one item through the 3.3 receipt sheet. */
async function receiveStock(page: Page, name: string): Promise<void> {
  await clickByName(page, message("stock.receive.open"));
  await waitForDialogSettled(page);
  await typeInto(page, "#receive-item-0", name);
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("[role=dialog] button")).some((button) =>
        button.textContent?.includes(wanted),
      ),
    {},
    name,
  );
  await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("[role=dialog] button")).find((element) =>
      element.textContent?.includes(wanted),
    );
    (button as HTMLElement | undefined)?.click();
  }, name);
  await typeInto(page, "#receive-qty-0", String(RECEIVED_GRAMS));
  await typeInto(page, "#receive-cost-0", "0.05");
  await clickByName(page, message("stock.receive.submit"));
  await page.waitForSelector("[role=dialog]", { hidden: true });
}

async function createItemsAndReceiveStockThroughUi(): Promise<void> {
  const page = await ownerPage();
  await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock`, "main");
  for (const name of [RICE_ITEM, SUGAR_ITEM]) {
    await createStockItem(page, name);
    await receiveStock(page, name);
  }
  await closePage(page);
}

async function inventoryItemIdOf(name: string): Promise<string> {
  const body = await apiGet<{ data: { inventoryItemId: string; name: string }[] }>(
    `/orgs/${organizationId}/inventory-items?q=${encodeURIComponent(name)}&limit=8`,
  );
  const found = body.data.find((item) => item.name === name);
  if (found === undefined) throw new Error(`No stock item named ${name}`);
  return found.inventoryItemId;
}

interface SeededProduct {
  readonly offeringId: string;
  readonly variantId: string;
}

/** Creates and publishes a PRODUCT whose one piece draws its grams from a stock item. */
async function seedProduct(
  name: string,
  priceMinor: number,
  inventoryItemId: string,
  gramsPerPiece: number,
): Promise<SeededProduct> {
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
          stockComponents: [{ inventoryItemId, quantity: gramsPerPiece }],
        },
      ],
    },
  });
  // Safe: the API answers with the { data: OfferingResponse } envelope (14 section 4).
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: owner.cookies,
    body: { version: offering.data.version },
  });
  return {
    offeringId: offering.data.offeringId,
    variantId: offering.data.variants[0]?.variantId as string,
  };
}

/** Types into the lazy product picker and clicks the result row with the product's name. */
async function addProductLine(
  page: Page,
  index: number,
  productName: string,
  quantity: string,
): Promise<void> {
  await typeInto(page, `#order-product-${index}`, productName);
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("main button")).some(
        (button) => button.textContent?.includes(wanted) && button.getClientRects().length > 0,
      ),
    {},
    productName,
  );
  await page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("main button")).find((element) =>
      element.textContent?.includes(wanted),
    );
    (button as HTMLElement | undefined)?.click();
  }, productName);
  await typeInto(page, `#order-qty-${index}`, quantity);
}

/** A pickup order needs a contact with a phone (the retail rules), so the order page makes one inline. */
async function addNewContact(page: Page, name: string, phone: string): Promise<void> {
  await clickByName(page, message("form.contactLink.createNew"));
  await typeInto(page, "#order-contact-new-name", name);
  await typeInto(page, "#order-contact-new-phone", phone);
}

async function waitForOrderPath(page: Page): Promise<string> {
  await page.waitForFunction(
    (slug) => new RegExp(`^/${slug}/orders/[0-9a-f-]{36}$`, "u").test(window.location.pathname),
    {},
    ORG_SLUG,
  );
  return new URL(page.url()).pathname;
}

function orderIdOfPath(path: string): string {
  return path.split("/").at(-1) ?? "";
}

/** The phone card of the row with this order number (DataList renders cards below the md breakpoint). */
async function cardTextOf(page: Page, text: string): Promise<string> {
  return page.evaluate((wanted) => {
    const card = Array.from(document.querySelectorAll("main li")).find((item) =>
      (item.textContent ?? "").includes(wanted),
    );
    return card?.textContent ?? "";
  }, text);
}

async function stockRowText(page: Page, itemName: string): Promise<string> {
  return cardTextOf(page, itemName);
}

async function waitForStockRow(page: Page, itemName: string, text: string): Promise<void> {
  await page.waitForFunction(
    (name, wanted) => {
      const row = Array.from(document.querySelectorAll("main li")).find((item) =>
        (item.textContent ?? "").includes(name),
      );
      return (row?.textContent ?? "").includes(wanted);
    },
    {},
    itemName,
    text,
  );
}

async function stockLevelOf(itemId: string): Promise<InventoryLevelRow> {
  const body = await apiGet<{ data: InventoryLevelRow[] }>(
    `/orgs/${organizationId}/stock/levels?locationId=${locationId}&limit=100`,
  );
  const level = body.data.find((row) => row.inventoryItemId === itemId);
  if (level === undefined) throw new Error(`No stock level for item ${itemId}`);
  return level;
}

describe("orders at a retail shop", () => {
  it("places, confirms, takes payment and completes two products, reducing stock", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, `/${ORG_SLUG}/orders/new`, "#order-product-0");
    await addNewContact(page, BUYER_NAME, "+8801710000601");
    await addProductLine(page, 0, RICE_PRODUCT, "2");
    await clickByName(page, message("orders.new.addLine"));
    await addProductLine(page, 1, SUGAR_PRODUCT, "1");

    await clickByName(page, message("orders.new.place"));
    orderDetailPath = await waitForOrderPath(page);
    await waitForBadge(page, message("orders.status.PLACED"));

    const orderTotal = formatMoney(
      { amount: ORDER_TOTAL_MINOR, currency: "BDT" },
      { locale: "bn" },
    );
    const placedText = await bodyText(page);
    expect(placedText).toContain(FIRST_ORDER_NUMBER);
    expect(placedText).toContain(orderTotal);

    await clickByName(page, message("orders.action.confirm"));
    await waitForBadge(page, message("orders.status.CONFIRMED"));

    await clickByName(page, message("orders.detail.receivePayment"));
    await waitForDialogSettled(page);
    await clickInDialog(page, message("payments.receive.submit"));
    await page.waitForFunction(() => document.querySelector("[role=dialog]") === null);
    await waitForBadge(page, message("payments.status.PAID"));

    await gotoWhenHydrated(page, `/${ORG_SLUG}/orders`, "main");
    await waitForText(page, FIRST_ORDER_NUMBER);
    await waitForBadge(page, message("payments.status.PAID"));
    const card = await cardTextOf(page, FIRST_ORDER_NUMBER);
    expect(card).toContain(message("payments.status.PAID"));
    expect(card).toContain(orderTotal);

    await gotoWhenHydrated(page, orderDetailPath, "main");
    await clickByName(page, message("orders.action.complete"));
    await waitForBadge(page, message("orders.status.COMPLETED"));

    const order = (
      await apiGet<{ data: OrderResponse }>(
        `/orgs/${organizationId}/orders/${orderIdOfPath(orderDetailPath)}`,
      )
    ).data;
    expect(order.status).toBe(ORDER_STATUS.COMPLETED);
    expect(order.paymentStatus).toBe(PAYMENT_STATUS.PAID);
    expect(order.orderNumber).toBe(FIRST_ORDER_NUMBER);
    expect(order.invoiceNumber).toBe(FIRST_ORDER_NUMBER);
    expect(order.totals.grandTotal).toEqual({ amount: ORDER_TOTAL_MINOR, currency: "BDT" });
    expect(order.lines.map((line) => line.quantity)).toEqual([2, 1]);

    const rice = await stockLevelOf(riceItemId);
    const sugar = await stockLevelOf(sugarItemId);
    expect(rice).toMatchObject({
      onHand: RECEIVED_GRAMS - 2 * RICE_GRAMS_PER_BAG,
      reserved: 0,
      available: RECEIVED_GRAMS - 2 * RICE_GRAMS_PER_BAG,
    });
    expect(sugar).toMatchObject({
      onHand: RECEIVED_GRAMS - SUGAR_GRAMS_PER_PACK,
      reserved: 0,
      available: RECEIVED_GRAMS - SUGAR_GRAMS_PER_PACK,
    });

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock?location=${locationId}`, "main");
    await waitForText(page, RICE_ITEM);
    await waitForStockRow(page, RICE_ITEM, String(rice.onHand));
    const riceText = await stockRowText(page, RICE_ITEM);
    const sugarText = await stockRowText(page, SUGAR_ITEM);
    await closePage(page);

    expect(riceText).toContain(String(RECEIVED_GRAMS - 2 * RICE_GRAMS_PER_BAG));
    expect(sugarText).toContain(String(RECEIVED_GRAMS - SUGAR_GRAMS_PER_PACK));
  }, 240_000);

  it("cancels a placed order and releases its reserved stock", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, `/${ORG_SLUG}/orders/new`, "#order-product-0");
    await addNewContact(page, BUYER_NAME, "+8801710000602");
    await addProductLine(page, 0, RICE_PRODUCT, "1");
    await clickByName(page, message("orders.new.place"));
    const secondPath = await waitForOrderPath(page);
    await waitForBadge(page, message("orders.status.PLACED"));

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock?location=${locationId}`, "main");
    await waitForText(page, RICE_ITEM);
    await waitForStockRow(page, RICE_ITEM, String(RECEIVED_GRAMS - 3 * RICE_GRAMS_PER_BAG));

    await gotoWhenHydrated(page, secondPath, "main");
    await clickByName(page, message("orders.action.cancel"));
    await waitForDialogSettled(page);
    await page.type("#order-cancel-reason", "ক্রেতা অর্ডারটি বাতিল করেছেন");
    await clickInDialog(page, message("orders.cancel.submit"));
    await waitForBadge(page, message("orders.status.CANCELLED"));

    const cancelled = (
      await apiGet<{ data: OrderResponse }>(
        `/orgs/${organizationId}/orders/${orderIdOfPath(secondPath)}`,
      )
    ).data;
    expect(cancelled.status).toBe(ORDER_STATUS.CANCELLED);
    expect(cancelled.orderNumber).toBe(SECOND_ORDER_NUMBER);

    const rice = await stockLevelOf(riceItemId);
    expect(rice).toMatchObject({
      onHand: RECEIVED_GRAMS - 2 * RICE_GRAMS_PER_BAG,
      reserved: 0,
      available: RECEIVED_GRAMS - 2 * RICE_GRAMS_PER_BAG,
    });

    await gotoWhenHydrated(page, `/${ORG_SLUG}/catalog/stock?location=${locationId}`, "main");
    await waitForText(page, RICE_ITEM);
    await page.waitForFunction(
      (name, released) => {
        const row = Array.from(document.querySelectorAll("main li")).find((item) =>
          (item.textContent ?? "").includes(name),
        );
        const text = row?.textContent ?? "";
        return text.includes(released) && !text.includes("7000");
      },
      {},
      RICE_ITEM,
      String(RECEIVED_GRAMS - 2 * RICE_GRAMS_PER_BAG),
    );
    const riceText = await stockRowText(page, RICE_ITEM);
    await closePage(page);

    expect(riceText).not.toContain("7000");
  }, 180_000);

  const routes = [
    ["list", () => `/${ORG_SLUG}/orders`],
    ["new order", () => `/${ORG_SLUG}/orders/new`],
    ["draft detail", () => draftDetailPath],
  ] as const;

  it.each(routes)(
    "%s stays within the initial JavaScript budget",
    async (name, path) => {
      const page = await ownerPage();
      const size = await measureInitialJs(page, path());
      process.stdout.write(`initial JS orders ${name}: ${toKiB(size.gzipBytes)} KiB\n`);
      await closePage(page);

      expect(toKiB(size.gzipBytes), name).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    },
    120_000,
  );

  it.each(routes)(
    "%s has no sideways scroll and touch targets of 44 px",
    async (name, path) => {
      const page = await ownerPage();
      await gotoWhenHydrated(page, path(), "main");
      await page.waitForFunction(
        () => document.querySelector("main form, main ul, main p") !== null,
      );
      const report = await page.evaluate((minimum) => {
        const overflow =
          document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const controls = Array.from(
          document.querySelectorAll(
            "main button, main a, main select, main input:not([type=file]):not([type=checkbox]), main textarea",
          ),
        );
        const small = controls
          .filter((control) => control.getClientRects().length > 0)
          .filter((control) => control.getBoundingClientRect().height < minimum)
          .map((control) => `${control.tagName} ${control.textContent?.trim().slice(0, 20)}`);
        return { overflow, small };
      }, MINIMUM_TOUCH_TARGET);
      await closePage(page);

      expect(report.overflow, name).toBeLessThanOrEqual(0);
      expect(report.small, name).toEqual([]);
    },
    120_000,
  );
});
