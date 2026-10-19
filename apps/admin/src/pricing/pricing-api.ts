import type {
  PromotionResponse,
  QuoteResponse,
  TaxClassResponse,
} from "@banijjik/contracts/pricing";
import { newId } from "@banijjik/ids";
import { apiFetch } from "../lib/api/api-client";

export async function listTaxClasses(organizationId: string): Promise<readonly TaxClassResponse[]> {
  const response = await apiFetch<TaxClassResponse[]>(
    `/orgs/${organizationId}/tax-classes?limit=100`,
  );
  return response.data;
}

export async function createTaxClass(
  organizationId: string,
  body: { taxClassKey: string; name: string; rateBasisPoints: number },
): Promise<TaxClassResponse> {
  const response = await apiFetch<TaxClassResponse>(`/orgs/${organizationId}/tax-classes`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return response.data;
}

export async function archiveTaxClass(
  organizationId: string,
  taxClassId: string,
  version: number,
): Promise<TaxClassResponse> {
  const response = await apiFetch<TaxClassResponse>(
    `/orgs/${organizationId}/tax-classes/${taxClassId}/archive`,
    { method: "POST", body: { version } },
  );
  return response.data;
}

export async function listPromotions(
  organizationId: string,
): Promise<readonly PromotionResponse[]> {
  const response = await apiFetch<PromotionResponse[]>(
    `/orgs/${organizationId}/promotions?limit=100`,
  );
  return response.data;
}

export async function createPromotion(
  organizationId: string,
  body: Record<string, unknown>,
): Promise<PromotionResponse> {
  const response = await apiFetch<PromotionResponse>(`/orgs/${organizationId}/promotions`, {
    method: "POST",
    body,
    idempotencyKey: newId(),
  });
  return response.data;
}

export async function updatePromotion(
  organizationId: string,
  promotionId: string,
  body: Record<string, unknown>,
): Promise<PromotionResponse> {
  const response = await apiFetch<PromotionResponse>(
    `/orgs/${organizationId}/promotions/${promotionId}`,
    { method: "PATCH", body },
  );
  return response.data;
}

export async function archivePromotion(
  organizationId: string,
  promotionId: string,
  version: number,
): Promise<PromotionResponse> {
  const response = await apiFetch<PromotionResponse>(
    `/orgs/${organizationId}/promotions/${promotionId}/archive`,
    { method: "POST", body: { version } },
  );
  return response.data;
}

export async function previewQuote(
  organizationId: string,
  body: {
    locationId: string;
    lines: readonly {
      offeringId: string;
      variantId: string;
      quantity: number;
    }[];
  },
): Promise<QuoteResponse> {
  const response = await apiFetch<QuoteResponse>(`/orgs/${organizationId}/quotes`, {
    method: "POST",
    body,
  });
  return response.data;
}
