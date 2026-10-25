import { SYSTEM_ROLE_KEY, type SystemRoleKey } from "@banijjik/contracts";
import { orderApprovalSubject } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { expect } from "vitest";
import { money } from "./catalog-world.js";
import type { IamApiHarness } from "./iam-api-harness.js";
import { addMemberWithAssignments, findSystemRoleId } from "./rbac-world.js";
import type { OrderLineRow, OrderRow } from "./sales-api-rows.js";
import {
  addCustomer,
  addInventoryItem,
  instantOrder,
  ordersPath,
  publishOffering,
  receiveStock,
  type SalesShop,
} from "./sales-api-world.js";
import type { TwoOrganizations } from "./two-organizations.js";

const PRICE = 1000;
const APPROVAL_PIN = "1234";
const HTTP_OK = 200;
const HTTP_CREATED = 201;
let phoneSequence = 0;

export interface ReturnLineRequest {
  readonly orderLineId: string;
  readonly quantity: number;
  readonly disposition?: string;
}

/** The parts of a return response the reverse tests read. */
export interface ReturnView {
  readonly salesReturnId: string;
  readonly version: number;
  readonly value: { readonly amount: number };
  readonly refund: { readonly amount: { readonly amount: number } };
}

/** The return body the client sends: quantities and dispositions only (plan 3.5b decision 11). */
export function returnBody(
  lines: readonly ReturnLineRequest[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    lines: lines.map((line) => ({
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      disposition: line.disposition ?? "RESTOCK",
    })),
    reasonKey: "CHANGED_MIND",
    refundMethod: "CASH",
    ...extra,
  };
}

export type ApiCall = ReturnType<SalesShop["actor"]["callWith"]>;

export function postReturn(
  actor: SalesShop["actor"],
  target: { readonly organizationId: string; readonly orderId: string },
  body: object,
): ApiCall {
  return actor.callWith({
    method: "post",
    path: ordersPath(target.organizationId, `/${target.orderId}/returns`),
    idempotencyKey: newId(),
    body,
  });
}

export function postReverse(
  actor: SalesShop["actor"],
  target: {
    readonly organizationId: string;
    readonly salesReturnId: string;
    readonly idempotencyKey?: string;
  },
  body: object,
): ApiCall {
  return actor.callWith({
    method: "post",
    path: `/orgs/${target.organizationId}/sales/returns/${target.salesReturnId}/reverse`,
    idempotencyKey: target.idempotencyKey ?? newId(),
    body,
  });
}

export function expectRuleRefused(
  response: { status: number; body: unknown },
  ruleKey: string,
): void {
  const body = response.body as { error: { code: string; details: { ruleKey: string } } };
  expect(response.status).toBe(422);
  expect(body.error.code).toBe("BUSINESS_RULE");
  expect(body.error.details.ruleKey).toBe(ruleKey);
}

/** A counter sale of one product line, completed in the same request. */
export async function soldLine(
  shop: SalesShop,
  quantity: number,
  options: { readonly contactId?: string; readonly stockItemId?: string } = {},
): Promise<{ order: OrderRow; line: OrderLineRow }> {
  const product = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Tea ${newId()}`,
    priceAmount: PRICE,
    ...(options.stockItemId === undefined
      ? {}
      : { stockComponents: [{ inventoryItemId: options.stockItemId, quantity: 1 }] }),
  });
  const sold = await instantOrder(shop, {
    locationId: shop.locationId,
    ...(options.contactId === undefined ? {} : { contactId: options.contactId }),
    lines: [{ offeringId: product.offeringId, variantId: product.variantId, quantity }],
  });
  expect(sold.status).toBe(HTTP_CREATED);
  const line = sold.order.lines[0];
  if (line === undefined) throw new Error("expected a sold line");
  return { order: sold.order, line };
}

export async function detailOf(shop: SalesShop, orderId: string): Promise<OrderRow> {
  const response = await shop.actor.call("get", ordersPath(shop.organizationId, `/${orderId}`));
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as OrderRow;
}

export function payOrder(
  shop: SalesShop,
  orderId: string,
  payment: { readonly amount: number; readonly method?: string; readonly contactId?: string },
): ApiCall {
  return shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/payments`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      method: payment.method ?? "CASH",
      amount: money(payment.amount),
      ...(payment.contactId === undefined ? {} : { contactId: payment.contactId }),
      allocations: [{ requestType: "ORDER", requestId: orderId, amount: money(payment.amount) }],
    },
  });
}

/** A stocked item: `units` at `unitCost` each. */
export async function stockedItem(shop: SalesShop, unitCost = 100, units = 10): Promise<string> {
  const itemId = await addInventoryItem(shop, `Stock ${newId()}`);
  await receiveStock(shop, [
    { inventoryItemId: itemId, quantity: units, unitCostAmount: unitCost },
  ]);
  return itemId;
}

/** Sellable and damaged stock of one item, read through the stock API. */
export async function stockOf(
  shop: SalesShop,
  inventoryItemId: string,
): Promise<{ onHand: number; damaged: number }> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/stock/levels?locationId=${shop.locationId}&limit=50`,
  );
  expect(response.status).toBe(HTTP_OK);
  const rows = response.body.data as readonly {
    inventoryItemId: string;
    onHand: number;
    damaged: number;
  }[];
  const row = rows.find((entry) => entry.inventoryItemId === inventoryItemId);
  return { onHand: row?.onHand ?? 0, damaged: row?.damaged ?? 0 };
}

export interface MovementRow {
  readonly sourceId: string;
  readonly reason: string;
  readonly quantityDelta: number;
  readonly unitCost?: { readonly amount: number; readonly currency: string };
}

export async function movementsOfSource(
  shop: SalesShop,
  sourceId: string,
): Promise<readonly MovementRow[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/stock/movements?locationId=${shop.locationId}&limit=100`,
  );
  expect(response.status).toBe(HTTP_OK);
  return (response.body.data as readonly MovementRow[]).filter((row) => row.sourceId === sourceId);
}

/** A token of one approval action, granted by the owner with the PIN (ADR-121). */
export async function grantToken(
  world: TwoOrganizations,
  input: {
    readonly action: string;
    readonly orderId: string;
    readonly locationId: string;
    readonly amount: number;
  },
): Promise<string> {
  await world.alice.call("put", `/orgs/${world.organizationA}/me/approval-pin`, {
    currentPassword: world.alice.person.password,
    pin: APPROVAL_PIN,
  });
  const approvers = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/approvers?locationId=${input.locationId}`,
  );
  const granted = await world.alice.call("post", `/orgs/${world.organizationA}/approvals`, {
    action: input.action,
    subjectKey: orderApprovalSubject(input.orderId),
    amount: money(input.amount),
    locationId: input.locationId,
    approverMemberId: approvers.body.data[0].memberId,
    pin: APPROVAL_PIN,
  });
  expect(granted.status).toBe(HTTP_OK);
  return granted.body.data.approvalToken as string;
}

/** A new member of organization A with one role at one location (a cashier unless told). */
export async function memberAt(
  harness: IamApiHarness,
  world: TwoOrganizations,
  assignment: { readonly locationId: string; readonly roleKey?: SystemRoleKey },
): Promise<SalesShop["actor"]> {
  const roleId = await findSystemRoleId(
    harness.connections,
    world.organizationA,
    assignment.roleKey ?? SYSTEM_ROLE_KEY.CASHIER,
  );
  const added = await addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: assignment.locationId, roleId },
  ]);
  return added.actor;
}

export async function newContact(shop: SalesShop): Promise<string> {
  phoneSequence += 1;
  return addCustomer(
    shop,
    `Rahim ${phoneSequence}`,
    `+88017${String(phoneSequence).padStart(8, "0")}`,
  );
}

/** The dues of ORDER requests, as the dues list shows them. */
export async function orderDues(
  shop: SalesShop,
): Promise<readonly { requestId: string; due: { amount: number } }[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/dues?requestType=ORDER`,
  );
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as readonly { requestId: string; due: { amount: number } }[];
}

/** Sells and pays a counter order in full, returns its numbers and the return of its whole line. */
export async function paidReturn(
  shop: SalesShop,
  options: {
    readonly quantity: number;
    readonly returned: number;
    readonly disposition?: string;
    readonly refundMethod?: string;
    readonly contactId?: string;
    readonly stockItemId?: string;
  },
): Promise<{ order: OrderRow; line: OrderLineRow; salesReturn: ReturnView }> {
  const { order, line } = await soldLine(shop, options.quantity, {
    ...(options.contactId === undefined ? {} : { contactId: options.contactId }),
    ...(options.stockItemId === undefined ? {} : { stockItemId: options.stockItemId }),
  });
  expect(
    (await payOrder(shop, order.orderId, { amount: order.totals.grandTotal.amount })).status,
  ).toBe(HTTP_CREATED);
  const created = await postReturn(
    shop.actor,
    { organizationId: shop.organizationId, orderId: order.orderId },
    returnBody(
      [
        {
          orderLineId: line.orderLineId,
          quantity: options.returned,
          disposition: options.disposition ?? "RESTOCK",
        },
      ],
      { refundMethod: options.refundMethod ?? "CASH" },
    ),
  );
  expect(created.status).toBe(HTTP_CREATED);
  return { order, line, salesReturn: created.body.data };
}
