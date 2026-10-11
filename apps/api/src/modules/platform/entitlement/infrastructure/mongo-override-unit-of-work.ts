import { withTransaction } from "../../../../kernel/db/index.js";
import type { OverrideUnitOfWork } from "../application/ports/override-admin-ports.js";

/** A real transaction on the platform database; nested calls join the surrounding one (ADR-084). */
export class MongoOverrideUnitOfWork implements OverrideUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result> {
    return withTransaction(work);
  }
}
