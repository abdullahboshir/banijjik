import type { OfferingKind } from "@banijjik/contracts";
import type {
  Money,
  OfferingLocationResponse,
  OfferingResponse,
} from "@banijjik/contracts/catalog";
import { apiFetch } from "../lib/api/api-client";
import type { OfferingPayload } from "./offering-request";

/** The payload plus the extra details, when the business has any. */
export type OfferingBody = OfferingPayload & { customFields?: Record<string, unknown> };

function offeringsBase(organizationId: string): string {
  return `/orgs/${organizationId}/offerings`;
}

/** `POST /offerings`; the same key on a retry gives the same offering. */
export async function createOffering(
  organizationId: string,
  input: { kind: OfferingKind; body: OfferingBody; idempotencyKey: string },
): Promise<OfferingResponse> {
  // Create schema omits optional clears; null means "not set" on the form (same as description).
  const { description, taxClassKey, ...rest } = input.body;
  const result = await apiFetch<OfferingResponse>(offeringsBase(organizationId), {
    method: "POST",
    body: {
      kind: input.kind,
      ...rest,
      ...(description === null ? {} : { description }),
      ...(taxClassKey === null ? {} : { taxClassKey }),
    },
    idempotencyKey: input.idempotencyKey,
  });
  return result.data;
}

export async function updateOffering(
  organizationId: string,
  input: { offeringId: string; version: number; body: OfferingBody },
): Promise<OfferingResponse> {
  const result = await apiFetch<OfferingResponse>(
    `${offeringsBase(organizationId)}/${input.offeringId}`,
    { method: "PATCH", body: { ...input.body, version: input.version } },
  );
  return result.data;
}

export async function transitionOffering(
  organizationId: string,
  input: { offeringId: string; version: number; action: "publish" | "archive" },
): Promise<OfferingResponse> {
  const result = await apiFetch<OfferingResponse>(
    `${offeringsBase(organizationId)}/${input.offeringId}/${input.action}`,
    { method: "POST", body: { version: input.version } },
  );
  return result.data;
}

/** The branch rows of one location (the editor asks one location at a time). */
export async function readBranchRows(
  organizationId: string,
  offeringId: string,
  locationId: string,
): Promise<OfferingLocationResponse[]> {
  const result = await apiFetch<OfferingLocationResponse[]>(
    `${offeringsBase(organizationId)}/${offeringId}/locations?locationId=${locationId}&limit=100`,
  );
  return result.data;
}

export interface BranchRowInput {
  offeringId: string;
  locationId: string;
  variantId?: string | undefined;
  isAvailable: boolean;
  priceOverride?: Money | undefined;
}

export async function saveBranchRow(organizationId: string, input: BranchRowInput): Promise<void> {
  const { offeringId, locationId, ...body } = input;
  await apiFetch(`${offeringsBase(organizationId)}/${offeringId}/locations/${locationId}`, {
    method: "PUT",
    body,
  });
}

export async function clearBranchRow(
  organizationId: string,
  input: { offeringId: string; locationId: string; variantId?: string | undefined },
): Promise<void> {
  const query = input.variantId ? `?variantId=${input.variantId}` : "";
  await apiFetch(
    `${offeringsBase(organizationId)}/${input.offeringId}/locations/${input.locationId}${query}`,
    { method: "DELETE" },
  );
}
