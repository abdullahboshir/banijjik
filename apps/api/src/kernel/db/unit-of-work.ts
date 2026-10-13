import { withTransaction } from "./with-transaction.js";

/**
 * A real transaction on the platform database; nested calls join the surrounding one (ADR-084).
 * Every module declares its own `UnitOfWork` port with this one `run` method, and this class satisfies all of them.
 */
export class MongoUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result> {
    return withTransaction(work);
  }
}
