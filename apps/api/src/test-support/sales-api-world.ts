import { newId } from "@banijjik/ids";
import { expect } from "vitest";
import { money, offeringsPath } from "./catalog-world.js";
import type { ApiActor, TwoOrganizations } from "./two-organizations.js";
import type {
  OfferingInput,
  OrderListItemRow,
  OrderLinesInput,
  OrderRow,
  QuoteRow,
  StockLevelRow,
  StockMovementRow,
  StockReceiptInput,
} from "./sales-api-rows.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

/** The caller, the organization and the location a sales request is made for. */
export interface SalesShop {
  readonly actor: ApiActor;
  readonly organizationId: string;
  readonly locationId: string;
}

/** The usual shop of a sales test: the owner of organization A at its default location. */
export function shopOf(world: TwoOrganizations): SalesShop {
  return {
    actor: world.alice,
    organizationId: world.organizationA,
    locationId: world.locationA1,
  };
}

export function ordersPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/orders${suffix}`;
}

/** A tracked inventory item, counted in grams, the unit these tests receive stock in. */
export async function addInventoryItem(shop: SalesShop, name: string): Promise<string> {
  const created = await shop.actor.call("post", `/orgs/${shop.organizationId}/inventory-items`, {
    name,
    baseUnitKey: "GRAM",
  });
  expect(created.status).toBe(HTTP_CREATED);
  return created.body.data.inventoryItemId as string;
}

/** Create and publish an offering with one variant, and return its ids. */
export async function publishOffering(
  shop: SalesShop,
  input: OfferingInput,
): Promise<{ offeringId: string; variantId: string }> {
  const created = await shop.actor.call("post", offeringsPath(shop.organizationId), {
    kind: input.kind,
    name: input.name,
    ...(input.taxClassKey === undefined ? {} : { taxClassKey: input.taxClassKey }),
    ...(input.kindDetails === undefined ? {} : { kindDetails: input.kindDetails }),
    variants: [
      {
        name: "Default",
        price: money(input.priceAmount),
        unitKey: input.unitKey ?? "PIECE",
        ...(input.stockComponents === undefined ? {} : { stockComponents: input.stockComponents }),
      },
    ],
  });
  expect(created.status).toBe(HTTP_CREATED);
  const offeringId = created.body.data.offeringId as string;
  const published = await shop.actor.call(
    "post",
    offeringsPath(shop.organizationId, `/${offeringId}/publish`),
    { version: created.body.data.version as number },
  );
  expect(published.status).toBe(HTTP_OK);
  const [variant] = published.body.data.variants as readonly { variantId: string }[];
  if (variant === undefined) throw new Error("expected a published variant");
  return { offeringId, variantId: variant.variantId };
}

/** Stock the counter can sell: one receipt line per item, priced in minor units. */
export async function receiveStock(
  shop: SalesShop,
  lines: readonly StockReceiptInput[],
): Promise<void> {
  const received = await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/stock/receipts`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      lines: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        unitCost: money(line.unitCostAmount),
      })),
    },
  });
  expect(received.status).toBe(HTTP_CREATED);
}

/** A contact a pickup order can call back. */
export async function addCustomer(
  shop: SalesShop,
  name: string,
  phoneE164: string,
): Promise<string> {
  const created = await shop.actor.call("post", `/orgs/${shop.organizationId}/contacts`, {
    contactType: "PERSON",
    name,
    phoneE164,
    contactRoles: ["CUSTOMER"],
  });
  expect(created.status).toBe(HTTP_CREATED);
  return created.body.data.contactId as string;
}

export async function draftOrder(shop: SalesShop, body: object): Promise<OrderRow> {
  const created = await shop.actor.call("post", ordersPath(shop.organizationId), body);
  expect(created.status).toBe(HTTP_CREATED);
  return created.body.data as OrderRow;
}

/** `POST /orders/{orderId}/place`; a token is the discount approval the place consumes. */
export async function placeOrder(
  shop: SalesShop,
  input: {
    readonly orderId: string;
    readonly version: number;
    readonly approvalToken?: string;
    readonly idempotencyKey?: string;
  },
): Promise<{ status: number; order: OrderRow }> {
  const body: Record<string, unknown> = { version: input.version };
  if (input.approvalToken !== undefined) body["approvalToken"] = input.approvalToken;
  return orderResultOf(
    await shop.actor.callWith({
      method: "post",
      path: ordersPath(shop.organizationId, `/${input.orderId}/place`),
      body,
      ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
    }),
  );
}

/** `PATCH /orders/{orderId}`: an absent field stays as it is, `null` clears an optional one. */
export async function patchOrder(
  shop: SalesShop,
  input: { readonly orderId: string; readonly body: object },
): Promise<{ status: number; order: OrderRow }> {
  return orderResultOf(
    await shop.actor.call(
      "patch",
      ordersPath(shop.organizationId, `/${input.orderId}`),
      input.body,
    ),
  );
}

/**
 * `POST /orders/instant`: the counter sale that creates, places and completes in one request.
 * It moves money and stock, so it needs an idempotency key unless the test proves the guard.
 */
export async function instantOrder(
  shop: SalesShop,
  body: object,
  idempotencyKey: string | null = newId(),
): Promise<{ status: number; order: OrderRow }> {
  const path = ordersPath(shop.organizationId, "/instant");
  const response =
    idempotencyKey === null
      ? await shop.actor.call("post", path, body)
      : await shop.actor.callWith({ method: "post", path, body, idempotencyKey });
  return orderResultOf(response);
}

/** A lifecycle step that only carries the version: confirm, pack, complete. */
export async function transitionOrder(
  shop: SalesShop,
  input: {
    readonly orderId: string;
    readonly action: "confirm" | "pack" | "complete";
    readonly version: number;
  },
): Promise<{ status: number; order: OrderRow }> {
  return orderResultOf(
    await shop.actor.call(
      "post",
      ordersPath(shop.organizationId, `/${input.orderId}/${input.action}`),
      { version: input.version },
    ),
  );
}

export async function confirmOrder(
  shop: SalesShop,
  input: { readonly orderId: string; readonly version: number },
): Promise<OrderRow> {
  return okOrderOf(await transitionOrder(shop, { ...input, action: "confirm" }));
}

export async function completeOrder(
  shop: SalesShop,
  input: { readonly orderId: string; readonly version: number },
): Promise<OrderRow> {
  return okOrderOf(await transitionOrder(shop, { ...input, action: "complete" }));
}

export async function cancelOrder(
  shop: SalesShop,
  input: { readonly orderId: string; readonly version: number; readonly reason: string },
): Promise<{ status: number; order: OrderRow }> {
  return orderResultOf(
    await shop.actor.call("post", ordersPath(shop.organizationId, `/${input.orderId}/cancel`), {
      version: input.version,
      reason: input.reason,
    }),
  );
}

export async function getOrder(shop: SalesShop, orderId: string): Promise<OrderRow> {
  const response = await shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}`));
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as OrderRow;
}

export async function listOrders(
  shop: SalesShop,
  query = "",
): Promise<readonly OrderListItemRow[]> {
  const response = await shop.actor.call(
    "get",
    `${ordersPath(shop.organizationId)}?limit=50${query}`,
  );
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as readonly OrderListItemRow[];
}

/** A setting of a fresh organization: the first write of a key needs no version. */
export async function setSetting(
  shop: SalesShop,
  settingKey: string,
  value: unknown,
): Promise<void> {
  const response = await shop.actor.call("patch", `/orgs/${shop.organizationId}/settings`, {
    items: [{ settingKey, value }],
  });
  expect(response.status).toBe(HTTP_OK);
}

/** The server's own answer for the same lines, so a test can compare an order to the quoter. */
export async function quoteOf(
  shop: SalesShop,
  lines: readonly OrderLinesInput[],
): Promise<QuoteRow> {
  const response = await shop.actor.call("post", `/orgs/${shop.organizationId}/quotes`, {
    locationId: shop.locationId,
    lines,
  });
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as QuoteRow;
}

export async function stockLevelsOf(shop: SalesShop): Promise<readonly StockLevelRow[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/stock/levels?locationId=${shop.locationId}&limit=50`,
  );
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as readonly StockLevelRow[];
}

/** On-hand and reserved for one item; a level that was never touched reads as zero. */
export async function levelOf(
  shop: SalesShop,
  inventoryItemId: string,
): Promise<{ onHand: number; reserved: number }> {
  const rows = await stockLevelsOf(shop);
  const row = rows.find((entry) => entry.inventoryItemId === inventoryItemId);
  return { onHand: row?.onHand ?? 0, reserved: row?.reserved ?? 0 };
}

export async function movementsOf(shop: SalesShop): Promise<readonly StockMovementRow[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/stock/movements?locationId=${shop.locationId}&limit=100`,
  );
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as readonly StockMovementRow[];
}

/** The ledger rows one order wrote (`sourceId` is the order id, ADR-131). */
export async function orderMovements(
  shop: SalesShop,
  orderId: string,
): Promise<readonly StockMovementRow[]> {
  const rows = await movementsOf(shop);
  return rows.filter((row) => row.sourceId === orderId);
}

/**
 * The discount approval of one order: a member with `iam.approval.grant` and a PIN gives the token
 * the place request then consumes.
 */
export async function approvalTokenFor(
  requester: ApiActor,
  organizationId: string,
  input: {
    readonly approverMemberId: string;
    readonly subjectKey: string;
    readonly locationId: string;
    readonly pin: string;
  },
): Promise<string> {
  const response = await requester.call("post", `/orgs/${organizationId}/approvals`, {
    action: "DISCOUNT",
    subjectKey: input.subjectKey,
    locationId: input.locationId,
    approverMemberId: input.approverMemberId,
    pin: input.pin,
  });
  expect(response.status).toBe(HTTP_OK);
  return response.body.data.approvalToken as string;
}

function orderResultOf(response: { status: number; body: { data: unknown } }): {
  status: number;
  order: OrderRow;
} {
  return { status: response.status, order: response.body.data as OrderRow };
}

function okOrderOf(result: { status: number; order: OrderRow }): OrderRow {
  expect(result.status).toBe(HTTP_OK);
  return result.order;
}
