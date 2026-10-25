import { newId } from "@banijjik/ids";

/** The last checkout request this till sent: its body text and the key it went with. */
export interface CheckoutAttempt {
  readonly bodyText: string;
  readonly idempotencyKey: string;
}

/**
 * The key for the next checkout request (ADR-014). The same body keeps the same key, so a retry after
 * a lost answer replays the first sale instead of charging again. A changed body gets a new key,
 * so an edited tender is never answered with the earlier request's response.
 */
export function attemptFor(previous: CheckoutAttempt | null, bodyText: string): CheckoutAttempt {
  if (previous && previous.bodyText === bodyText) return previous;
  return { bodyText, idempotencyKey: newId() };
}
