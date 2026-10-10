import { AsyncLocalStorage } from "node:async_hooks";
import { ERROR_CODE } from "@banijjik/contracts";
import type { ClientSession } from "mongoose";
import { AppError } from "../http/app-error.js";
import { reportError } from "../observability/report-error.js";
import { getDatabaseConnections } from "./database-connections.js";
import {
  backoffDelayMs,
  commitWithRetry,
  DEFAULT_MAX_ATTEMPTS,
  hasErrorLabel,
  sleep,
  TRANSIENT_TRANSACTION_LABEL,
} from "./transaction-retry.js";

export interface TransactionOptions {
  readonly maxAttempts?: number;
}

type CommittedCallback = () => Promise<void>;

interface TransactionState {
  readonly session: ClientSession;
  readonly committedCallbacks: CommittedCallback[];
}

const transactionStorage = new AsyncLocalStorage<TransactionState>();

const TRANSACTION_SETTINGS = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", journal: true },
} as const;

/** The session of the surrounding transaction. Repositories pass it as `{ session }` to every query. */
export function getActiveSession(): ClientSession | undefined {
  return transactionStorage.getStore()?.session;
}

/**
 * Runs `callback` once, after the current transaction commits, in registration order. It never
 * runs when the transaction aborts. It is for in-process follow-ups such as cache invalidation:
 * side effects like SMS, courier calls or AI go through the outbox (card 1.5), never here.
 * Outside a transaction it throws, because a missing transaction is a bug, not a case to hide.
 */
export function onCommitted(callback: CommittedCallback): void {
  const state = transactionStorage.getStore();
  if (state === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.no_active_transaction" });
  }
  state.committedCallbacks.push(callback);
}

async function runCommittedCallbacks(callbacks: readonly CommittedCallback[]): Promise<void> {
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (error) {
      // The data is already committed, so a failing follow-up is reported, never thrown.
      reportError(error, {});
    }
  }
}

/** Aborting must never hide the error that caused it, so a failing abort is reported and dropped. */
async function abortIfActive(session: ClientSession): Promise<void> {
  if (!session.inTransaction()) return;
  try {
    await session.abortTransaction();
  } catch (abortError) {
    reportError(abortError, {});
  }
}

async function runAttempt<Result>(
  work: (session: ClientSession) => Promise<Result>,
  maxAttempts: number,
): Promise<Result> {
  const session = await getDatabaseConnections().platform.startSession();
  const state: TransactionState = { session, committedCallbacks: [] };
  try {
    const result = await transactionStorage.run(state, async () => {
      session.startTransaction(TRANSACTION_SETTINGS);
      const workResult = await work(session);
      await commitWithRetry(session, maxAttempts);
      return workResult;
    });
    await runCommittedCallbacks(state.committedCallbacks);
    return result;
  } catch (error) {
    await abortIfActive(session);
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * All-or-nothing writes across the platform and tenant databases. A nested call joins the
 * surrounding transaction (same session). The whole attempt is repeated, with a short backoff,
 * when the server labels the failure TransientTransactionError. Idempotency is card 1.5.
 */
export async function withTransaction<Result>(
  work: (session: ClientSession) => Promise<Result>,
  options: TransactionOptions = {},
): Promise<Result> {
  const outer = transactionStorage.getStore();
  if (outer !== undefined) return work(outer.session);

  const { maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runAttempt(work, maxAttempts);
    } catch (error) {
      const canRetry = hasErrorLabel(error, TRANSIENT_TRANSACTION_LABEL) && attempt < maxAttempts;
      if (!canRetry) throw error;
      await sleep(backoffDelayMs(attempt));
    }
  }
}
