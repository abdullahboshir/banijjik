import type {
  CheckoutRequest,
  CheckoutResponse,
  GuestSessionResponse,
  PublicQuoteRequest,
  PublicQuoteResponse,
} from "@banijjik/contracts/website";
import { callStorefront, type ClientResult } from "../api/client-api";
import { isMissingSession } from "./checkout-outcome";

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

function sendQuote(
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
 * Requests a server-calculated, 5-minute price quote for checkout selections.
 * A first-time visitor has no guest cookie, so the quote answers 401. Only then a guest session is
 * created, once, and the quote is sent once more. A valid session is never replaced, because the
 * session is created only after the server said there is none. Checkout later runs under this session.
 */
export async function requestQuote(
  organizationId: string,
  body: PublicQuoteRequest,
): Promise<ClientResult<PublicQuoteResponse>> {
  const firstAnswer = await sendQuote(organizationId, body);
  if (!isMissingSession(firstAnswer)) return firstAnswer;
  const session = await createGuestSession(organizationId);
  // The session's own refusal (guest checkout off, rate limit) explains the failure better than the stale 401.
  if (!session.ok) return { ...session, data: undefined };
  return sendQuote(organizationId, body);
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
