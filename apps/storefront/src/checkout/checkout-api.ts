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

const HTTP_UNAUTHORIZED = 401;

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
 * The first cart visit has no guest cookie yet, so an unauthenticated answer creates the guest
 * session the quote needs and asks again; an existing session is reused and never rotated.
 */
export async function requestQuote(
  organizationId: string,
  body: PublicQuoteRequest,
): Promise<ClientResult<PublicQuoteResponse>> {
  const quote = (): Promise<ClientResult<PublicQuoteResponse>> =>
    callStorefront<PublicQuoteResponse>(
      "POST",
      `/orgs/${encodeURIComponent(organizationId)}/quotes`,
      { body },
    );
  const first = await quote();
  if (first.status !== HTTP_UNAUTHORIZED) return first;
  const session = await createGuestSession(organizationId);
  if (!session.ok) return first;
  return quote();
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
