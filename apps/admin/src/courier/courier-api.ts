import type {
  ConsignmentResponse,
  CourierSettlementResponse,
  CreateConsignmentRequest,
  RecordCourierSettlementRequest,
  ReverseCourierSettlementRequest,
} from "@banijjik/contracts/courier";
import { newId } from "@banijjik/ids";
import type { ConsignmentListQuery } from "@banijjik/validation/courier";
import { apiFetch, type ApiResult } from "../lib/api/api-client";

export async function listConsignments(
  organizationId: string,
  query: Partial<ConsignmentListQuery> = {},
): Promise<ApiResult<ConsignmentResponse[], { readonly hasNext?: boolean }>> {
  const params = new URLSearchParams();
  if (query.orderId) params.set("orderId", query.orderId);
  if (query.courierKey) params.set("courierKey", query.courierKey);
  if (query.locationId) params.set("locationId", query.locationId);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const qs = params.toString();
  const path = `/orgs/${organizationId}/courier/consignments${qs ? `?${qs}` : ""}`;
  return apiFetch<ConsignmentResponse[]>(path);
}

export async function createConsignment(
  organizationId: string,
  body: CreateConsignmentRequest,
): Promise<ConsignmentResponse> {
  const result = await apiFetch<ConsignmentResponse>(
    `/orgs/${organizationId}/courier/consignments`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function recordCourierSettlement(
  organizationId: string,
  body: RecordCourierSettlementRequest,
): Promise<CourierSettlementResponse> {
  const result = await apiFetch<CourierSettlementResponse>(
    `/orgs/${organizationId}/courier/settlements`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function reverseCourierSettlement(
  organizationId: string,
  courierSettlementId: string,
  body: ReverseCourierSettlementRequest,
): Promise<CourierSettlementResponse> {
  const result = await apiFetch<CourierSettlementResponse>(
    `/orgs/${organizationId}/courier/settlements/${courierSettlementId}/reverse`,
    {
      method: "POST",
      body,
      idempotencyKey: newId(),
    },
  );
  return result.data;
}
