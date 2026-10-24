import type {
  CommissionPayoutPreviewResponse,
  CommissionPayoutResponse,
  CommissionRuleResponse,
} from "@banijjik/contracts/commission";
import type {
  CommissionPayoutCreateBody,
  CommissionPayoutPreviewQuery,
  CommissionRuleArchiveBody,
  CommissionRuleCreateBody,
  CommissionRuleUpdateBody,
} from "@banijjik/validation/commission";
import { apiFetch } from "../lib/api/api-client";

function rulesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/commission/rules${suffix}`;
}

/** `POST /commission/rules`; the API refuses a duplicate slot with `errors.commission_rule_duplicate`. */
export async function createCommissionRule(
  organizationId: string,
  body: CommissionRuleCreateBody,
): Promise<CommissionRuleResponse> {
  const result = await apiFetch<CommissionRuleResponse>(rulesPath(organizationId), {
    method: "POST",
    body,
  });
  return result.data;
}

/** `PATCH /commission/rules/{commissionRuleId}`: only the calculation and the version, never the slot. */
export async function updateCommissionRule(
  organizationId: string,
  commissionRuleId: string,
  body: CommissionRuleUpdateBody,
): Promise<CommissionRuleResponse> {
  const result = await apiFetch<CommissionRuleResponse>(
    rulesPath(organizationId, `/${commissionRuleId}`),
    { method: "PATCH", body },
  );
  return result.data;
}

export async function archiveCommissionRule(
  organizationId: string,
  commissionRuleId: string,
  body: CommissionRuleArchiveBody,
): Promise<CommissionRuleResponse> {
  const result = await apiFetch<CommissionRuleResponse>(
    rulesPath(organizationId, `/${commissionRuleId}/archive`),
    { method: "POST", body },
  );
  return result.data;
}

function payoutPreviewPath(organizationId: string, query: CommissionPayoutPreviewQuery): string {
  const params = new URLSearchParams({
    memberId: query.memberId,
    location: query.location,
    upTo: query.upTo,
  });
  return `/orgs/${organizationId}/commission/payouts/preview?${params.toString()}`;
}

export async function previewCommissionPayout(
  organizationId: string,
  query: CommissionPayoutPreviewQuery,
): Promise<CommissionPayoutPreviewResponse> {
  const result = await apiFetch<CommissionPayoutPreviewResponse>(
    payoutPreviewPath(organizationId, query),
  );
  return result.data;
}

/** `POST /commission/payouts`; a retry of the same body reuses its Idempotency-Key. */
export async function createCommissionPayout(
  organizationId: string,
  body: CommissionPayoutCreateBody,
  idempotencyKey: string,
): Promise<CommissionPayoutResponse> {
  const result = await apiFetch<CommissionPayoutResponse>(
    `/orgs/${organizationId}/commission/payouts`,
    { method: "POST", body, idempotencyKey },
  );
  return result.data;
}
