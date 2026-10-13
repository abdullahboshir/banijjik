import {
  IDEMPOTENCY_STATUS,
  type IdempotencyScopeKind,
  type IdempotencyStatus,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { isDuplicateKeyError, models } from "../db/index.js";
import {
  IDEMPOTENCY_RECORD_MODEL_NAME,
  type IdempotencyRecordDocument,
} from "./idempotency-record.schema.js";

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_HOUR = 60 * 60 * MILLISECONDS_PER_SECOND;
/** How long a request may run before another one with the same key may take its place. */
export const IDEMPOTENCY_LOCK_SECONDS = 60;
/** How long a key is remembered (14-API.md: the stored answer of an earlier request). */
export const IDEMPOTENCY_RETENTION_HOURS = 24;

export interface IdempotencyKeyRef {
  readonly scopeKind: IdempotencyScopeKind;
  readonly scopeId: string;
  readonly idempotencyKey: string;
}

/** What the middleware needs to know about a record that already exists. */
export interface StoredIdempotencyRecord {
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly lockedUntil: Date;
  readonly responseStatus?: number;
  readonly responseBody?: string;
}

/** `record` is missing when the winner released the key between the failed insert and the read. */
export type ClaimResult =
  | { readonly claimed: true }
  | { readonly claimed: false; readonly record?: StoredIdempotencyRecord };

export interface IdempotencyStore {
  claim(ref: IdempotencyKeyRef, requestHash: string, now: Date): Promise<ClaimResult>;
  /** Takes over an IN_PROGRESS record whose lock has expired. False when someone else got there first. */
  reclaim(ref: IdempotencyKeyRef, requestHash: string, now: Date): Promise<boolean>;
  complete(ref: IdempotencyKeyRef, response: { status: number; body: string }): Promise<void>;
  /** Deletes an IN_PROGRESS record so the client may retry with the same key. */
  release(ref: IdempotencyKeyRef, requestHash: string): Promise<void>;
}

function lockExpiry(now: Date): Date {
  return new Date(now.getTime() + IDEMPOTENCY_LOCK_SECONDS * MILLISECONDS_PER_SECOND);
}

function keyFilter(ref: IdempotencyKeyRef): IdempotencyKeyRef {
  const { scopeKind, scopeId, idempotencyKey } = ref;
  return { scopeKind, scopeId, idempotencyKey };
}

function records() {
  return models({}).get<IdempotencyRecordDocument>(IDEMPOTENCY_RECORD_MODEL_NAME);
}

/** The platform-database store behind the middleware. Every query carries an explicit scope. */
export class MongoIdempotencyStore implements IdempotencyStore {
  async claim(ref: IdempotencyKeyRef, requestHash: string, now: Date): Promise<ClaimResult> {
    try {
      await records().create({
        idempotencyRecordId: newId(),
        ...keyFilter(ref),
        requestHash,
        status: IDEMPOTENCY_STATUS.IN_PROGRESS,
        lockedUntil: lockExpiry(now),
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_HOURS * MILLISECONDS_PER_HOUR),
      });
      return { claimed: true };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      return this.readExisting(ref);
    }
  }

  async reclaim(ref: IdempotencyKeyRef, requestHash: string, now: Date): Promise<boolean> {
    const result = await records().updateOne(
      {
        ...keyFilter(ref),
        requestHash,
        status: IDEMPOTENCY_STATUS.IN_PROGRESS,
        lockedUntil: { $lte: now },
      },
      { $set: { lockedUntil: lockExpiry(now) } },
    );
    return result.modifiedCount === 1;
  }

  async complete(
    ref: IdempotencyKeyRef,
    response: { status: number; body: string },
  ): Promise<void> {
    await records().updateOne(
      { ...keyFilter(ref), status: IDEMPOTENCY_STATUS.IN_PROGRESS },
      {
        $set: {
          status: IDEMPOTENCY_STATUS.COMPLETED,
          responseStatus: response.status,
          responseBody: response.body,
        },
      },
    );
  }

  async release(ref: IdempotencyKeyRef, requestHash: string): Promise<void> {
    await records().deleteOne({
      ...keyFilter(ref),
      requestHash,
      status: IDEMPOTENCY_STATUS.IN_PROGRESS,
    });
  }

  private async readExisting(ref: IdempotencyKeyRef): Promise<ClaimResult> {
    const record = await records()
      .findOne(keyFilter(ref))
      .select("requestHash status lockedUntil responseStatus responseBody")
      .lean<StoredIdempotencyRecord>();
    return record === null ? { claimed: false } : { claimed: false, record };
  }
}
