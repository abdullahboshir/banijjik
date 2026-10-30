import type { Money } from "@banijjik/contracts/pricing";
import type { CheckoutRequestLink } from "@banijjik/contracts/website";
import { callStorefront, type ClientResult } from "../api/client-api";

export type { CheckoutRequestLink };

export interface CheckoutContactSnapshot {
  readonly name: string;
  readonly phoneE164: string;
}

export type CheckoutOwnerType = "CUSTOMER" | "GUEST";
export type RequestType = "ORDER" | "BOOKING" | "ENROLLMENT";

export function parseRequestType(value: string): RequestType {
  const upper = value.toUpperCase();
  if (upper === "BOOKING") return "BOOKING";
  if (upper === "ENROLLMENT") return "ENROLLMENT";
  return "ORDER";
}

export interface CheckoutDetailResponse {
  readonly checkoutId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly status: string;
  readonly requests: readonly CheckoutRequestLink[];
  readonly contactSnapshot: CheckoutContactSnapshot;
  readonly acceptedTotals: Money;
  readonly createdAt: string;
  readonly ownerType: CheckoutOwnerType;
  readonly canClaim: boolean;
}

export interface RequestHistoryItem {
  readonly requestType: RequestType;
  readonly requestId: string;
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly holdExpiresAt: string | null;
  readonly createdAt: string;
  readonly details?: Record<string, unknown>;
}

export interface ClaimCheckoutResponse {
  readonly success: boolean;
  readonly checkoutId: string;
}

export interface RequestDetailResponse extends RequestHistoryItem {
  readonly items?: readonly unknown[];
  readonly schedule?: unknown;
  readonly plan?: unknown;
  readonly fulfillment?: unknown;
}

export interface RequestHistoryResponse {
  readonly items: readonly RequestHistoryItem[];
}

/**
 * Fetch checkout detail through the storefront proxy.
 * Works for both guest sessions (via sf_guest cookie) and authenticated customers.
 */
export async function getCheckoutDetail(
  organizationId: string,
  checkoutId: string,
): Promise<ClientResult<CheckoutDetailResponse>> {
  return callStorefront<CheckoutDetailResponse>(
    "GET",
    `/orgs/${organizationId}/checkouts/${checkoutId}`,
  );
}

/**
 * Claim a guest checkout into the signed-in customer's verified account.
 * Requires that the current customer has an OTP-verified phone matching the checkout contact.
 */
export async function claimCheckout(
  organizationId: string,
  checkoutId: string,
): Promise<ClientResult<ClaimCheckoutResponse>> {
  return callStorefront<ClaimCheckoutResponse>(
    "POST",
    `/orgs/${organizationId}/checkouts/${checkoutId}/claim`,
  );
}

/**
 * Fetch the request history (orders, bookings, enrollments) for the current session.
 */
export async function getRequestHistory(
  organizationId: string,
): Promise<ClientResult<RequestHistoryResponse>> {
  return callStorefront<RequestHistoryResponse>("GET", `/orgs/${organizationId}/me/requests`);
}

/**
 * Fetch individual request detail for the current session.
 */
export async function getRequestDetail(
  organizationId: string,
  requestType: RequestType | string,
  requestId: string,
): Promise<ClientResult<RequestDetailResponse>> {
  return callStorefront<RequestDetailResponse>(
    "GET",
    `/orgs/${organizationId}/me/requests/${requestType}/${requestId}`,
  );
}
