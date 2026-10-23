import type {
  ApprovalGrantRequest,
  ApprovalGrantResponse,
  ApproverSummary,
} from "@banijjik/contracts/iam";
import type {
  Money,
  StoreCreditDirection,
  StoreCreditEntryResponse,
} from "@banijjik/contracts/payment";
import type { ApiResult } from "../lib/api/parse-api-response";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

export interface StoreCreditAdjustment {
  contactId: string;
  direction: StoreCreditDirection;
  amount: Money;
  reason: string;
}

export function adjustStoreCredit(
  organizationId: string,
  body: StoreCreditAdjustment & { approvalToken: string },
  idempotencyKey: string,
): Promise<ApiResult<StoreCreditEntryResponse>> {
  return apiFetch<StoreCreditEntryResponse>(`/orgs/${organizationId}/store-credit/adjustments`, {
    method: "POST",
    body,
    idempotencyKey,
  });
}

export async function listStoreCredit(
  organizationId: string,
  contactId: string,
  page: number,
): Promise<ApiResult<StoreCreditEntryResponse[], { total: number }>> {
  const search = new URLSearchParams({ contactId, page: String(page), limit: "20" });
  return apiFetch<StoreCreditEntryResponse[], { total: number }>(
    `/orgs/${organizationId}/store-credit?${search}`,
  );
}

export async function listApprovers(
  organizationId: string,
  locationId: string,
): Promise<ApproverSummary[]> {
  const query = new URLSearchParams({ locationId });
  return (await apiFetch<ApproverSummary[]>(`/orgs/${organizationId}/approvers?${query}`)).data;
}

export async function grantApproval(
  organizationId: string,
  body: ApprovalGrantRequest,
): Promise<ApprovalGrantResponse> {
  return (
    await apiFetch<ApprovalGrantResponse>(`/orgs/${organizationId}/approvals`, {
      method: "POST",
      body,
      idempotencyKey: newId(),
    })
  ).data;
}
