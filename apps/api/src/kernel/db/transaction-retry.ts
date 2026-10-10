import type { ClientSession } from "mongoose";

export const TRANSIENT_TRANSACTION_LABEL = "TransientTransactionError";
export const UNKNOWN_COMMIT_RESULT_LABEL = "UnknownTransactionCommitResult";

export const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_MS: readonly number[] = [50, 200, 800];

function readLabels(error: unknown): readonly string[] {
  if (typeof error !== "object" || error === null) return [];
  const labels = (error as { errorLabels?: unknown }).errorLabels;
  if (Array.isArray(labels)) return labels.map(String);
  if (labels instanceof Set) return [...labels].map(String);
  return [];
}

export function hasErrorLabel(error: unknown, label: string): boolean {
  return readLabels(error).includes(label);
}

/** Wait before the next try: 50, 200, then 800 ms for every later attempt. */
export function backoffDelayMs(failedAttempt: number): number {
  const fallback = BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
  return BACKOFF_MS[failedAttempt - 1] ?? fallback;
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Commits the transaction. Only the commit is repeated when its result is unknown: the server may
 * already have applied it, and committing again is safe, while running the work again would not be.
 */
export async function commitWithRetry(session: ClientSession, maxAttempts: number): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await session.commitTransaction();
      return;
    } catch (error) {
      const canRetry = hasErrorLabel(error, UNKNOWN_COMMIT_RESULT_LABEL) && attempt < maxAttempts;
      if (!canRetry) throw error;
      await sleep(backoffDelayMs(attempt));
    }
  }
}
