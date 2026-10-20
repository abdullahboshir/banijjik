import { ERROR_CODE, ERROR_HTTP_STATUS } from "@banijjik/contracts";
import { ApiError } from "../lib/api/api-error";

export function isVersionConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === ERROR_HTTP_STATUS.CONFLICT || error.code === ERROR_CODE.CONFLICT)
  );
}

export async function runReviewAction(input: {
  action: () => Promise<unknown>;
  leaveQueue: boolean;
  onBusy: (busy: boolean) => void;
  onConflict: () => void;
  onSuccessLeave: () => void;
  onSuccessStay: () => void;
}): Promise<void> {
  input.onBusy(true);
  try {
    await input.action();
    if (input.leaveQueue) {
      input.onSuccessLeave();
      return;
    }
    input.onSuccessStay();
  } catch (error) {
    if (isVersionConflict(error)) {
      input.onConflict();
      return;
    }
    throw error;
  } finally {
    input.onBusy(false);
  }
}
