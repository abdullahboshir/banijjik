import { newId } from "@banijjik/ids";
import { expect } from "vitest";
import { money } from "./catalog-world.js";
import { payOrder, newContact, soldLine, type ApiCall } from "./sales-return-world.js";
import type { OrderLineRow, OrderRow } from "./sales-api-rows.js";
import { ordersPath, publishOffering, type SalesShop } from "./sales-api-world.js";

/** Shared exchange fixtures (plan 3.5b A3): the exchange body, its calls and the paid counter sale. */
const HTTP_OK = 200;
const HTTP_CREATED = 201;

export interface ExchangeOptions {
  readonly returned: readonly {
    readonly orderLineId: string;
    readonly quantity: number;
    readonly disposition?: string;
  }[];
  readonly sold: readonly {
    readonly offeringId: string;
    readonly variantId: string;
    readonly quantity: number;
  }[];
  readonly payments?: readonly { readonly method: string; readonly amount: number }[];
  readonly orderDiscount?: { readonly type: string; readonly value: number };
  readonly returnApprovalTokens?: { readonly refund?: string; readonly returnNotReceived?: string };
  readonly orderApprovalToken?: string;
}

/** The exchange body: the return lines, the new order's lines, and the payments on the new order. */
export function exchangeBody(options: ExchangeOptions): Record<string, unknown> {
  return {
    return: {
      lines: options.returned.map((line) => ({
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        disposition: line.disposition ?? "RESTOCK",
      })),
      reasonKey: "CHANGED_MIND",
      ...(options.returnApprovalTokens === undefined
        ? {}
        : { approvalTokens: options.returnApprovalTokens }),
    },
    order: {
      lines: options.sold.map((line) => ({
        offeringId: line.offeringId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      ...(options.orderDiscount === undefined ? {} : { orderDiscount: options.orderDiscount }),
      ...(options.orderApprovalToken === undefined
        ? {}
        : { approvalToken: options.orderApprovalToken }),
    },
    payments: (options.payments ?? []).map((payment) => ({
      method: payment.method,
      amount: money(payment.amount),
    })),
  };
}

/** The exchange target: the order and, when a test replays a request, the Idempotency-Key it sends. */
export interface ExchangeTarget {
  readonly organizationId: string;
  readonly orderId: string;
  readonly idempotencyKey?: string;
}

export function postExchange(
  actor: SalesShop["actor"],
  target: ExchangeTarget,
  body: object,
): ApiCall {
  return actor.callWith({
    method: "post",
    path: ordersPath(target.organizationId, `/${target.orderId}/exchange`),
    idempotencyKey: target.idempotencyKey ?? newId(),
    body,
  });
}

export function previewExchange(
  actor: SalesShop["actor"],
  target: ExchangeTarget,
  body: object,
): ApiCall {
  return actor.call(
    "post",
    ordersPath(target.organizationId, `/${target.orderId}/exchange/preview`),
    body,
  );
}

/** The returns of one order, as the list shows them. */
export async function returnsOf(
  shop: SalesShop,
  orderId: string,
): Promise<readonly { salesReturnId: string }[]> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/sales/returns?orderId=${orderId}`,
  );
  expect(response.status).toBe(HTTP_OK);
  return response.body.data as readonly { salesReturnId: string }[];
}

/** The store-credit balance of a contact: its CREDIT entries less its DEBIT entries. */
export async function creditBalanceOf(shop: SalesShop, contactId: string): Promise<number> {
  const response = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/store-credit?contactId=${contactId}`,
  );
  expect(response.status).toBe(HTTP_OK);
  const entries = response.body.data as readonly {
    direction: string;
    amount: { amount: number };
  }[];
  return entries.reduce(
    (sum, entry) =>
      sum + (entry.direction === "CREDIT" ? entry.amount.amount : -entry.amount.amount),
    0,
  );
}

interface SoldLine {
  readonly order: OrderRow;
  readonly line: OrderLineRow;
}

/** A counter sale that is paid in full, with the contact it was sold to. */
export interface PaidSale extends SoldLine {
  readonly contactId: string;
}

/** A counter sale of `quantity` units with a contact, paid in full in cash. */
export async function paidSale(
  shop: SalesShop,
  quantity: number,
  stockItemId?: string,
): Promise<PaidSale> {
  const contactId = await newContact(shop);
  const sold = await soldLine(shop, quantity, {
    contactId,
    ...(stockItemId === undefined ? {} : { stockItemId }),
  });
  const paid = await payOrder(shop, sold.order.orderId, {
    amount: sold.order.totals.grandTotal.amount,
  });
  expect(paid.status).toBe(HTTP_CREATED);
  return { ...sold, contactId };
}

export async function newProduct(
  shop: SalesShop,
  priceAmount: number,
): Promise<{ offeringId: string; variantId: string }> {
  return publishOffering(shop, { kind: "PRODUCT", name: `Item ${newId()}`, priceAmount });
}
