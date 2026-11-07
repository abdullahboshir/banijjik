import type {
  CreateDeliveryAssignmentRequest,
  DeliveryAssignmentResponse,
  RecordRiderCashHandoverRequest,
  ReverseRiderCashHandoverRequest,
  RiderCashHandoverResponse,
} from "@banijjik/contracts/delivery";
import { newId } from "@banijjik/ids";
import type { DeliveryAssignmentListQuery } from "@banijjik/validation/delivery";
import { apiFetch, type ApiResult } from "../lib/api/api-client";

export async function listDeliveryAssignments(
  organizationId: string,
  query: Partial<DeliveryAssignmentListQuery> = {},
): Promise<ApiResult<DeliveryAssignmentResponse[], { readonly hasNext?: boolean }>> {
  const params = new URLSearchParams();
  if (query.orderId) params.set("orderId", query.orderId);
  if (query.riderMemberId) params.set("riderMemberId", query.riderMemberId);
  if (query.locationId) params.set("locationId", query.locationId);
  if (query.status) params.set("status", query.status);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const qs = params.toString();
  const path = `/orgs/${organizationId}/delivery/assignments${qs ? `?${qs}` : ""}`;
  return apiFetch<DeliveryAssignmentResponse[]>(path);
}

export async function createDeliveryAssignment(
  organizationId: string,
  body: CreateDeliveryAssignmentRequest,
): Promise<DeliveryAssignmentResponse> {
  const result = await apiFetch<DeliveryAssignmentResponse>(
    `/orgs/${organizationId}/delivery/assignments`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function recordRiderCashHandover(
  organizationId: string,
  body: RecordRiderCashHandoverRequest,
): Promise<RiderCashHandoverResponse> {
  const result = await apiFetch<RiderCashHandoverResponse>(
    `/orgs/${organizationId}/delivery/handovers`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function reverseRiderCashHandover(
  organizationId: string,
  riderCashHandoverId: string,
  body: ReverseRiderCashHandoverRequest,
): Promise<RiderCashHandoverResponse> {
  const result = await apiFetch<RiderCashHandoverResponse>(
    `/orgs/${organizationId}/delivery/handovers/${riderCashHandoverId}/reverse`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}
