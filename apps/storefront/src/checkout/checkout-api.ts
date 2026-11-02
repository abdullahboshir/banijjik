import type {
  CheckoutRequest,
  CheckoutResponse,
  GuestSessionResponse,
  PublicQuoteRequest,
  PublicQuoteResponse,
} from "@banijjik/contracts/website";
import { callStorefront, type ClientResult } from "../api/client-api";

export interface CheckoutApiError {
  readonly code?: string;
  readonly message?: string;
}

/**
 * Creates a guest session for an anonymous customer.
 * Sets the httpOnly sf_guest cookie through the storefront proxy.
 */
export async function createGuestSession(
  organizationId: string,
): Promise<ClientResult<GuestSessionResponse>> {
  return callStorefront<GuestSessionResponse>(
    "POST",
    `/orgs/${encodeURIComponent(organizationId)}/guest-session`,
  );
}

/**
 * Requests a server-calculated, 5-minute price quote for checkout selections.
 */
export async function requestQuote(
  organizationId: string,
  body: PublicQuoteRequest,
): Promise<ClientResult<PublicQuoteResponse>> {
  return callStorefront<PublicQuoteResponse>(
    "POST",
    `/orgs/${encodeURIComponent(organizationId)}/quotes`,
    { body },
  );
}

/**
 * Submits the final checkout. Uses a stable Idempotency-Key.
 * Replays are handled transparently by the server.
 */
export async function submitCheckout(
  organizationId: string,
  idempotencyKey: string,
  body: CheckoutRequest,
): Promise<ClientResult<CheckoutResponse>> {
  return callStorefront<CheckoutResponse>(
    "POST",
    `/orgs/${encodeURIComponent(organizationId)}/checkout`,
    {
      body,
      idempotencyKey,
    },
  );
}
