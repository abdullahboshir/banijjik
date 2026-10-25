import type {
  SalesReturnListItem,
  SalesReturnPreviewResponse,
  SalesReturnResponse,
} from "@banijjik/contracts/sales";
import type {
  SalesReturnRequestBody,
  SalesReturnReverseRequestBody,
} from "@banijjik/validation/sales";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

export interface SalesReturnListPage {
  readonly items: readonly SalesReturnListItem[];
  readonly page: number;
  readonly limit: number;
  readonly hasNext: boolean;
}

function returnsBase(organizationId: string): string {
  return `/orgs/${organizationId}/sales/returns`;
}

/** The server computes every amount; the preview writes nothing and needs no idempotency key. */
export async function previewReturn(
  organizationId: string,
  orderId: string,
  body: SalesReturnRequestBody,
): Promise<SalesReturnPreviewResponse> {
  const result = await apiFetch<SalesReturnPreviewResponse>(
    `/orgs/${organizationId}/orders/${orderId}/returns/preview`,
    { method: "POST", body },
  );
  return result.data;
}

/**
 * Creates the return. It moves money and stock, so the caller passes one key per submit and reuses
 * it on a retry of the same submit (plan 3.5b decision 11, card B).
 */
export interface CreateReturnInput {
  readonly organizationId: string;
  readonly orderId: string;
  readonly body: SalesReturnRequestBody;
  readonly idempotencyKey: string;
}

export async function createReturn(input: CreateReturnInput): Promise<SalesReturnResponse> {
  const result = await apiFetch<SalesReturnResponse>(
    `/orgs/${input.organizationId}/orders/${input.orderId}/returns`,
    { method: "POST", body: input.body, idempotencyKey: input.idempotencyKey },
  );
  return result.data;
}

export async function listReturns(
  organizationId: string,
  query: string,
): Promise<SalesReturnListPage> {
  const result = await apiFetch<
    SalesReturnListItem[],
    { page?: number; limit?: number; hasNext?: boolean }
  >(`${returnsBase(organizationId)}?${query}`);
  return {
    items: result.data,
    page: result.meta?.page ?? 1,
    limit: result.meta?.limit ?? result.data.length,
    hasNext: result.meta?.hasNext ?? false,
  };
}

export async function getReturn(
  organizationId: string,
  salesReturnId: string,
): Promise<SalesReturnResponse> {
  const result = await apiFetch<SalesReturnResponse>(
    `${returnsBase(organizationId)}/${salesReturnId}`,
  );
  return result.data;
}

/** A reversal moves money and stock: one idempotency key per submit, reused on a retry. */
export interface ReverseReturnInput {
  readonly organizationId: string;
  readonly salesReturnId: string;
  readonly body: SalesReturnReverseRequestBody;
  readonly idempotencyKey: string;
}

export async function reverseReturn(input: ReverseReturnInput): Promise<SalesReturnResponse> {
  const result = await apiFetch<SalesReturnResponse>(
    `${returnsBase(input.organizationId)}/${input.salesReturnId}/reverse`,
    { method: "POST", body: input.body, idempotencyKey: input.idempotencyKey },
  );
  return result.data;
}

/** A fresh key for a new submit; the sheets keep it for retries of that same submit. */
export function newSubmitKey(): string {
  return newId();
}
