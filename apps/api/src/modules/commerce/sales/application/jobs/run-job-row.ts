import { ERROR_CODE } from "@banijjik/contracts";
import { getLogger } from "../../../../../kernel/logger/index.js";
import { AppError } from "../../../../../kernel/http/index.js";
import { DomainRuleError } from "../../domain/errors.js";

/**
 * One row of an hourly pass. A row staff moved on meanwhile (a 409 version conflict or a
 * transition the status no longer allows) is skipped, so one raced order cannot stop the pass
 * and starve every order behind it (R1-4). Any other error is logged with the row id and the
 * pass continues with the next row.
 */
export async function runJobRow(orderId: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (rowMovedOn(error)) return;
    getLogger().warn(
      { event: "sales.job_row_failed", orderId, err: error },
      "a scheduled sales row failed; continuing with the next row",
    );
  }
}

function rowMovedOn(error: unknown): boolean {
  return (
    (error instanceof AppError && error.code === ERROR_CODE.CONFLICT) ||
    (error instanceof DomainRuleError && error.code === ERROR_CODE.INVALID_TRANSITION)
  );
}
