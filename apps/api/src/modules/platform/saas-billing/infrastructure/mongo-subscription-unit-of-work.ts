import { withTransaction } from "../../../../kernel/db/index.js";
import type { SubscriptionUnitOfWork } from "../application/ports/subscription-admin-ports.js";

/** A real transaction on the platform database; nested calls join the surrounding one (ADR-084). */
export class MongoSubscriptionUnitOfWork implements SubscriptionUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result> {
    return withTransaction(work);
  }
}
