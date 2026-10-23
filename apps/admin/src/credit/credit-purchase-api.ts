import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

/** The shape of `GET /orgs/{organizationId}/credit/purchases` (a page in the data, not the envelope). */
export interface CreditPurchasePage {
  items: CreditPurchaseResponse[];
  total: number;
  page: number;
  limit: number;
}

function purchasePath(organizationId: string, creditPurchaseId: string): string {
  return `/orgs/${organizationId}/credit/purchases/${creditPurchaseId}`;
}

export async function verifyCreditPurchase(
  organizationId: string,
  input: { creditPurchaseId: string; version: number; approvalToken?: string },
): Promise<CreditPurchaseResponse> {
  const result = await apiFetch<CreditPurchaseResponse>(
    `${purchasePath(organizationId, input.creditPurchaseId)}/verify`,
    {
      method: "POST",
      body: {
        version: input.version,
        ...(input.approvalToken === undefined ? {} : { approvalToken: input.approvalToken }),
      },
      idempotencyKey: newId(),
    },
  );
  return result.data;
}

export async function rejectCreditPurchase(
  organizationId: string,
  input: { creditPurchaseId: string; version: number; reason: string },
): Promise<CreditPurchaseResponse> {
  const result = await apiFetch<CreditPurchaseResponse>(
    `${purchasePath(organizationId, input.creditPurchaseId)}/reject`,
    {
      method: "POST",
      body: { version: input.version, reason: input.reason },
      idempotencyKey: newId(),
    },
  );
  return result.data;
}
