import type { OfferingKind } from "@banijjik/contracts";
import type { OfferingListItem, OfferingResponse } from "@banijjik/contracts/catalog";
import type { QuoteRequest, QuoteResponse } from "@banijjik/contracts/pricing";
import type {
  OrderListItem,
  OrderResponse,
  SalesPerformerResponse,
} from "@banijjik/contracts/sales";
import type {
  CreateDeliveryZoneRequest,
  DeliveryZone,
  UpdateDeliveryZoneRequest,
} from "@banijjik/contracts/sales/delivery";
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
import { mergeOfferingSearchByName, offeringSearchKinds } from "./search-offerings";

interface OrderAttempt {
  readonly bodyText: string;
  readonly idempotencyKey: string;
}

function attemptFor(previous: OrderAttempt | null, bodyText: string): OrderAttempt {
  if (previous?.bodyText === bodyText) return previous;
  return { bodyText, idempotencyKey: newId() };
}

const orderAttempts = new Map<string, OrderAttempt>();

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

/** The members who may perform a line at a location: names only, for the "Done by" select (plan 3.11 Refresh C). */
export async function listPerformers(
  organizationId: string,
  locationId: string,
): Promise<readonly SalesPerformerResponse[]> {
  const result = await apiFetch<SalesPerformerResponse[]>(
    `/orgs/${organizationId}/sales/performers?${new URLSearchParams({ locationId }).toString()}`,
  );
  return result.data;
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
  const attemptKey = `${organizationId}:${orderId}`;
  const bodyText = JSON.stringify(body);
  const attempt = attemptFor(orderAttempts.get(attemptKey) ?? null, bodyText);
  orderAttempts.set(attemptKey, attempt);
  const result = await apiFetch<OrderResponse>(`${ordersBase(organizationId)}/${orderId}/place`, {
    method: "POST",
    body,
    idempotencyKey: attempt.idempotencyKey,
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

async function searchOfferingsOfKind(
  organizationId: string,
  text: string,
  kind: OfferingKind,
): Promise<OfferingListItem[]> {
  const params = new URLSearchParams({
    q: text,
    kind,
    status: "ACTIVE",
    limit: "8",
  });
  const result = await apiFetch<OfferingListItem[]>(
    `/orgs/${organizationId}/offerings?${params.toString()}`,
  );
  return result.data;
}

/** Active offerings by name, SKU or barcode. Instant sales also search services (plan 3.40). */
export async function searchProducts(
  organizationId: string,
  text: string,
  includeServices = false,
): Promise<OfferingListItem[]> {
  const groups = await Promise.all(
    offeringSearchKinds(includeServices).map((kind) =>
      searchOfferingsOfKind(organizationId, text, kind),
    ),
  );
  return mergeOfferingSearchByName(groups);
}

export interface DeliveryZoneListPage {
  readonly items: readonly DeliveryZone[];
  readonly page: number;
  readonly limit: number;
  readonly hasNext: boolean;
}

export async function listDeliveryZones(
  organizationId: string,
  page = 1,
  limit = 50,
): Promise<DeliveryZoneListPage> {
  const result = await apiFetch<
    DeliveryZone[],
    { page?: number; limit?: number; hasNext?: boolean }
  >(`/orgs/${organizationId}/sales/delivery-zones?page=${page}&limit=${limit}`);
  return {
    items: result.data,
    page: result.meta?.page ?? page,
    limit: result.meta?.limit ?? limit,
    hasNext: result.meta?.hasNext ?? false,
  };
}

export async function createDeliveryZone(
  organizationId: string,
  body: CreateDeliveryZoneRequest,
): Promise<DeliveryZone> {
  const result = await apiFetch<DeliveryZone>(`/orgs/${organizationId}/sales/delivery-zones`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return result.data;
}

export async function updateDeliveryZone(
  organizationId: string,
  deliveryZoneId: string,
  body: UpdateDeliveryZoneRequest,
): Promise<DeliveryZone> {
  const result = await apiFetch<DeliveryZone>(
    `/orgs/${organizationId}/sales/delivery-zones/${deliveryZoneId}`,
    {
      method: "PATCH",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}
