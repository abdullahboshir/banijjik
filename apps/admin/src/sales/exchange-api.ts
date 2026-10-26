import type {
  SalesExchangePreviewResponse,
  SalesExchangeResponse,
} from "@banijjik/contracts/sales";
import type { SalesExchangeRequestBody } from "@banijjik/validation/sales";
import { apiFetch } from "../lib/api/api-client";

/** The server computes every amount; the preview writes nothing and needs no idempotency key. */
export async function previewExchange(
  organizationId: string,
  orderId: string,
  body: SalesExchangeRequestBody,
): Promise<SalesExchangePreviewResponse> {
  const result = await apiFetch<SalesExchangePreviewResponse>(
    `/orgs/${organizationId}/orders/${orderId}/exchange/preview`,
    { method: "POST", body },
  );
  return result.data;
}

/** The exchange moves money and stock: the caller passes one key per submit and reuses it on a retry. */
export interface CreateExchangeInput {
  readonly organizationId: string;
  readonly orderId: string;
  readonly body: SalesExchangeRequestBody;
  readonly idempotencyKey: string;
}

export async function createExchange(input: CreateExchangeInput): Promise<SalesExchangeResponse> {
  const result = await apiFetch<SalesExchangeResponse>(
    `/orgs/${input.organizationId}/orders/${input.orderId}/exchange`,
    { method: "POST", body: input.body, idempotencyKey: input.idempotencyKey },
  );
  return result.data;
}
