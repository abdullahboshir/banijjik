import type { ClientSession, Model, QueryFilter, UpdateQuery } from "mongoose";
import { conflict, notFound } from "../http/app-error.js";
import { stripMongoInternals } from "./mapper.js";
import { sessionOption } from "./session-option.js";
import { getActiveSession } from "./with-transaction.js";

export interface VersionedUpdateOptions<Document extends { version: number }> {
  readonly model: Model<Document>;
  readonly filter: QueryFilter<Document>;
  readonly expectedVersion: number;
  readonly update: UpdateQuery<Document>;
  /** Defaults to the session of the surrounding withTransaction, if any. */
  readonly session?: ClientSession;
}

type StoredDocument<Document> = Omit<Document, "_id" | "__v">;

async function throwConflictOrNotFound<Document extends { version: number }>(
  options: VersionedUpdateOptions<Document>,
  session: ClientSession | undefined,
): Promise<never> {
  const current = await options.model
    .findOne(options.filter, { version: 1 }, sessionOption(session))
    .lean<{ version: number }>();
  if (current === null) throw notFound();
  throw conflict({ currentVersion: current.version });
}

/**
 * Optimistic concurrency (ADR-036, 05-CONVENTIONS "Common fields"): the update applies only if the
 * stored `version` is still the one the caller read, and it bumps `version` by one. A stale version
 * is a 409 CONFLICT carrying `details.currentVersion`; no document at all is a 404. Schema validators
 * run on the update, so a value outside an enum is rejected like it would be on create.
 */
export async function updateVersioned<Document extends { version: number }>(
  options: VersionedUpdateOptions<Document>,
): Promise<StoredDocument<Document>> {
  const session = options.session ?? getActiveSession();
  // Safe: `version` is part of the Document constraint, so adding it to the filter stays a valid filter.
  const guardedFilter = {
    ...options.filter,
    version: options.expectedVersion,
  } as QueryFilter<Document>;
  const update = { ...options.update, $inc: { ...options.update.$inc, version: 1 } };

  const updated = await options.model
    .findOneAndUpdate(guardedFilter, update, {
      returnDocument: "after",
      runValidators: true,
      ...sessionOption(session),
    })
    .lean<Document>();
  if (updated === null) return throwConflictOrNotFound(options, session);
  return stripMongoInternals(updated);
}
