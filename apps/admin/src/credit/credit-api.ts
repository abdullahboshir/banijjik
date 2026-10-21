import type { CreditPack, CreditPackCreateRequest } from "@banijjik/contracts/credit";
import type {
  ApprovalGrantRequest,
  ApprovalGrantResponse,
  ApproverSummary,
} from "@banijjik/contracts/iam";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

/** The shape of `GET /orgs/{organizationId}/credit/packs` (a page in the data, not the envelope). */
export interface CreditPackPage {
  items: CreditPack[];
  total: number;
  page: number;
  limit: number;
}

export interface CreditAdjustWrite {
  credits: number;
  reason: string;
  approvalToken?: string;
}

function base(organizationId: string): string {
  return `/orgs/${organizationId}/credit`;
}

export async function createCreditPack(
  organizationId: string,
  body: CreditPackCreateRequest,
): Promise<CreditPack> {
  const result = await apiFetch<CreditPack>(`${base(organizationId)}/packs`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return result.data;
}

export async function updateCreditPack(
  organizationId: string,
  input: { creditPackId: string; version: number; body: CreditPackCreateRequest },
): Promise<CreditPack> {
  const result = await apiFetch<CreditPack>(`${base(organizationId)}/packs/${input.creditPackId}`, {
    method: "PATCH",
    body: { ...input.body, version: input.version },
  });
  return result.data;
}

export async function archiveCreditPack(
  organizationId: string,
  input: { creditPackId: string; version: number },
): Promise<CreditPack> {
  const result = await apiFetch<CreditPack>(
    `${base(organizationId)}/packs/${input.creditPackId}/archive`,
    { method: "POST", body: { version: input.version }, idempotencyKey: newId() },
  );
  return result.data;
}

/** Answer of `POST …/credit/accounts/{customerAccountId}/adjust`: the balance after the entry. */
export async function adjustCredits(
  organizationId: string,
  customerAccountId: string,
  body: CreditAdjustWrite,
): Promise<{ balance: number }> {
  const result = await apiFetch<{ balance: number }>(
    `${base(organizationId)}/accounts/${customerAccountId}/adjust`,
    { method: "POST", body, idempotencyKey: newId() },
  );
  return result.data;
}

export async function listApprovers(
  organizationId: string,
  locationId: string,
): Promise<ApproverSummary[]> {
  const params = new URLSearchParams({ locationId });
  return (await apiFetch<ApproverSummary[]>(`/orgs/${organizationId}/approvers?${params}`)).data;
}

export async function grantApproval(
  organizationId: string,
  body: ApprovalGrantRequest,
): Promise<ApprovalGrantResponse> {
  return (
    await apiFetch<ApprovalGrantResponse>(`/orgs/${organizationId}/approvals`, {
      method: "POST",
      body,
    })
  ).data;
}
