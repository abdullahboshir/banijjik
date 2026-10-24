import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../../../../kernel/http/app-error.js";
import { slotUnavailableError } from "../domain/errors.js";
import type { BookingUnitOfWork } from "./ports/booking-repositories.js";

const MAX_TXN_ATTEMPTS = 8;

/**
 * Retries transient transaction aborts. After the last attempt, maps RETRY_LATER to
 * SLOT_UNAVAILABLE so concurrent slot races answer 409 (plan: never double-book).
 */
export async function runWithTxnRetry<Result>(
  unitOfWork: BookingUnitOfWork,
  work: () => Promise<Result>,
  onRetryExhausted: () => Error = slotUnavailableError,
): Promise<Result> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await unitOfWork.run(work);
    } catch (error) {
      const isRetryLater = error instanceof AppError && error.code === ERROR_CODE.RETRY_LATER;
      if (isRetryLater && attempt < MAX_TXN_ATTEMPTS) continue;
      if (isRetryLater) throw onRetryExhausted();
      throw error;
    }
  }
}
