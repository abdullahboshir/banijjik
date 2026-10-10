import type { LimitKey } from "@banijjik/contracts";

/**
 * Port implemented by platform/entitlement: "may the organization of this request have one more
 * of this counted thing?" (10-MODULE-CATALOG section 9). The caller counts what exists now
 * (inside its transaction) and passes the count; a limit of `null` means unlimited.
 */
export interface LimitGuard {
  /** Throws `422 LIMIT_REACHED` with `details { limitKey, limit }` when `currentCount` has reached the limit. */
  assertBelow(limitKey: LimitKey, currentCount: number): Promise<void>;
}
