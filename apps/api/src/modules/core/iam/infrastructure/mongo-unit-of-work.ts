import { withTransaction } from "../../../../kernel/db/index.js";
import type { UnitOfWork } from "../application/ports/unit-of-work.js";

/** A real transaction on the platform database; nested calls join the surrounding one (ADR-084). */
export class MongoUnitOfWork implements UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result> {
    return withTransaction(work);
  }
}
