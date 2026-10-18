import type { Clock } from "../time/index.js";

/** Whether a customer account still exists and is ACTIVE. Read inside the business's tenant context. */
export interface CustomerAccountStatusReader {
  isActive(customerAccountId: string): Promise<boolean>;
}

const MILLISECONDS_PER_SECOND = 1000;
const MAX_CACHED_ACCOUNTS = 10_000;

interface CachedAnswer {
  readonly isActive: boolean;
  readonly expiresAtMs: number;
}

/**
 * Remembers each answer for `maxStaleSeconds`, so a signed-in customer costs one database read a
 * minute, not one per request. A block therefore takes effect within that window (ADR-119).
 */
export function cacheAccountStatus(
  reader: CustomerAccountStatusReader,
  options: { readonly clock: Clock; readonly maxStaleSeconds: number },
): CustomerAccountStatusReader {
  const answers = new Map<string, CachedAnswer>();
  return {
    async isActive(customerAccountId) {
      const nowMs = options.clock.now().getTime();
      const cached = answers.get(customerAccountId);
      if (cached !== undefined && cached.expiresAtMs > nowMs) return cached.isActive;
      const isActive = await reader.isActive(customerAccountId);
      if (answers.size >= MAX_CACHED_ACCOUNTS) answers.clear();
      answers.set(customerAccountId, {
        isActive,
        expiresAtMs: nowMs + options.maxStaleSeconds * MILLISECONDS_PER_SECOND,
      });
      return isActive;
    },
  };
}
