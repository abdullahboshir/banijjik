import type { ClientSession } from "mongoose";

export const TRANSIENT_TRANSACTION_LABEL = "TransientTransactionError";
export const UNKNOWN_COMMIT_RESULT_LABEL = "UnknownTransactionCommitResult";

export const DEFAULT_MAX_ATTEMPTS = 5;
const BACKOFF_START_MS = 50;
const BACKOFF_CAP_MS = 800;

/** A number in [0, 1). Injected so tests are deterministic; production uses Math.random. */
export type RandomSource = () => number;

function readLabels(error: unknown): readonly string[] {
  if (typeof error !== "object" || error === null) return [];
  // Safe: the driver's error classes carry an optional errorLabels; anything else yields undefined below.
  const labels = (error as { errorLabels?: unknown }).errorLabels;
  if (Array.isArray(labels)) return labels.map(String);
  if (labels instanceof Set) return [...labels].map(String);
  return [];
}

export function hasErrorLabel(error: unknown, label: string): boolean {
  return readLabels(error).includes(label);
}

/**
 * Wait before the next try (ADR-085): min(800, 50 * 2^(attempt-1)) ms, plus a random 0 to 100% of
 * that value. The jitter spreads out transactions that conflicted on the same document, so they
 * do not collide again at the same instant.
 */
export function backoffDelayMs(failedAttempt: number, random: RandomSource = Math.random): number {
  const base = Math.min(BACKOFF_CAP_MS, BACKOFF_START_MS * 2 ** (failedAttempt - 1));
  return base + Math.floor(random() * base);
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
