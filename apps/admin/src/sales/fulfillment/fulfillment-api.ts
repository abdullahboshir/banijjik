import type {
  DeliveryAttempt,
  DeliveryFailedRequest,
  DeliveryLossClosureResponse,
  DeliveryLossRecoveryResponse,
  ReceiveRtsRequest,
  ReconcileDeliveryLossRequest,
  RecoverDeliveryLossRequest,
  ShipOrderRequest,
} from "@banijjik/contracts/sales/delivery";
import type { OrderResponse } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../../lib/api/api-client";

export async function shipOrder(
  organizationId: string,
  orderId: string,
  body: ShipOrderRequest,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(
    `/orgs/${organizationId}/sales/orders/${orderId}/ship`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function reshipOrder(
  organizationId: string,
  orderId: string,
  body: ShipOrderRequest,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(
    `/orgs/${organizationId}/sales/orders/${orderId}/reship`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function recordDeliveryAttempt(
  organizationId: string,
  orderId: string,
  body: DeliveryFailedRequest,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(
    `/orgs/${organizationId}/sales/orders/${orderId}/delivery-attempts`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function receiveRts(
  organizationId: string,
  orderId: string,
  body: ReceiveRtsRequest,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(
    `/orgs/${organizationId}/sales/orders/${orderId}/rts`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function reconcileDeliveryLoss(
  organizationId: string,
  orderId: string,
  body: ReconcileDeliveryLossRequest,
): Promise<OrderResponse> {
  const result = await apiFetch<OrderResponse>(
    `/orgs/${organizationId}/sales/orders/${orderId}/delivery-loss/close`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function recoverDeliveryLoss(
  organizationId: string,
  orderId: string,
  body: RecoverDeliveryLossRequest,
): Promise<DeliveryLossRecoveryResponse> {
  const result = await apiFetch<DeliveryLossRecoveryResponse>(
    `/orgs/${organizationId}/sales/orders/${orderId}/delivery-loss/recover`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function getDeliveryLoss(
  organizationId: string,
  orderId: string,
): Promise<DeliveryLossClosureResponse | null> {
  const result = await apiFetch<DeliveryLossClosureResponse | null>(
    `/orgs/${organizationId}/sales/orders/${orderId}/delivery-loss`,
  );
  return result.data;
}

export async function listDeliveryAttempts(
  organizationId: string,
  orderId: string,
): Promise<readonly DeliveryAttempt[]> {
  const result = await apiFetch<readonly DeliveryAttempt[]>(
    `/orgs/${organizationId}/sales/orders/${orderId}/delivery-attempts`,
  );
  return result.data;
}
