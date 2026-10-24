import type { OfferingListItem, OfferingResponse } from "@banijjik/contracts/catalog";
import type { QuoteRequest, QuoteResponse } from "@banijjik/contracts/pricing";
import type { OrderListItem, OrderResponse } from "@banijjik/contracts/sales";
import type {
  OrderCancelBody,
  OrderCreateBody,
  OrderInstantBody,
  OrderPlaceBody,
  OrderTransitionBody,
  OrderUpdateBody,
} from "@banijjik/validation/sales";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

export interface OrderListPage {
  readonly items: readonly OrderListItem[];
  readonly page: number;
  readonly limit: number;
  readonly hasNext: boolean;
}

function ordersBase(organizationId: string): string {
  return `/orgs/${organizationId}/orders`;
}

export async function listOrders(organizationId: string, query: string): Promise<OrderListPage> {
  const result = await apiFetch<
    OrderListItem[],
    { page?: number; limit?: number; hasNext?: boolean }
  >(`${ordersBase(organizationId)}?${query}`);
  return {
    items: result.data,
    page: result.meta?.page ?? 1,
    limit: result.meta?.limit ?? result.data.length,
    hasNext: result.meta?.hasNext ?? false,
  };
}

export async function getOrder(organizationId: string, orderId: string): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}`);
  return result.data;
}

export async function createOrder(
  organizationId: string,
  body: OrderCreateBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(ordersBase(organizationId), {
    method: "POST",
    body,
  });
  return result.data;
}

export async function updateOrder(
  organizationId: string,
  orderId: string,
  body: OrderUpdateBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}`, {
    method: "PATCH",
    body,
  });
  return result.data;
}

export async function deleteDraft(
  organizationId: string,
  orderId: string,
  version: number,
): Promise<void> {
  await apiFetch(`${ordersBase(organizationId)}/${orderId}?version=${String(version)}`, {
    method: "DELETE",
  });
}

/** `place` moves stock, so a retry with the same idempotency key never reserves twice. */
export async function placeOrder(
  organizationId: string,
  orderId: string,
  body: OrderPlaceBody,
): Promise<OrderResponse> {
  const idempotencyKey = newId();
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}/place`, {
    method: "POST",
    body,
    idempotencyKey,
  });
  return result.data;
}

export async function confirmOrder(
  organizationId: string,
  orderId: string,
  body: OrderTransitionBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}/confirm`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function packOrder(
  organizationId: string,
  orderId: string,
  body: OrderTransitionBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}/pack`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function completeOrder(
  organizationId: string,
  orderId: string,
  body: OrderTransitionBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(
    `${ordersBase(organizationId)}/${orderId}/complete`,
    { method: "POST", body },
  );
  return result.data;
}

export async function cancelOrder(
  organizationId: string,
  orderId: string,
  body: OrderCancelBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}/cancel`, {
    method: "POST",
    body,
  });
  return result.data;
}

/** Create and complete in one transaction; the building block of the future POS screen. */
export async function instantOrder(
  organizationId: string,
  body: OrderInstantBody,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/instant`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return result.data;
}

export async function quoteOrder(
  organizationId: string,
  body: QuoteRequest,
): Promise<QuoteResponse> {
  const result = await apiFetch<QuoteResponse>(`/orgs/${organizationId}/quotes`, {
    method: "POST",
    body,
  });
  return result.data;
}

export async function getOffering(
  organizationId: string,
  offeringId: string,
): Promise<OfferingResponse> {
  const result = await apiFetch<OfferingResponse>(
    `/orgs/${organizationId}/offerings/${offeringId}`,
  );
  return result.data;
}

export async function searchProducts(
  organizationId: string,
  text: string,
): Promise<OfferingListItem[]> {
  const params = new URLSearchParams({
    q: text,
    kind: "PRODUCT",
    status: "ACTIVE",
    limit: "8",
  });
  const result = await apiFetch<OfferingListItem[]>(
    `/orgs/${organizationId}/offerings?${params.toString()}`,
  );
  return result.data;
}
