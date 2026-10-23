import type { CreditPurchaseMethod, CreditPurchaseStatus } from "@banijjik/contracts/credit";
import type { CreditPurchaseId, CustomerAccountId, UserId } from "@banijjik/ids";
import type { CreditPurchase } from "../../domain/credit-purchase.entity.js";

export interface ListCreditPurchasesStaffFilter {
  readonly status?: CreditPurchaseStatus | undefined;
  readonly q?: string | undefined;
  readonly offset: number;
  readonly limit: number;
}

export interface CreditPurchaseRepository {
  insert(purchase: CreditPurchase): Promise<void>;
  /** A stale version surfaces as the kernel's 409 conflict; a missing row as 404. */
  updateVersioned(purchase: CreditPurchase, updatedByUserId: UserId | null): Promise<void>;
  findById(creditPurchaseId: CreditPurchaseId): Promise<CreditPurchase | undefined>;
  findByReference(
    method: CreditPurchaseMethod,
    reference: string,
  ): Promise<CreditPurchase | undefined>;
  listByAccount(
    customerAccountId: CustomerAccountId,
    offset: number,
    limit: number,
  ): Promise<{ readonly items: readonly CreditPurchase[]; readonly total: number }>;
  countPendingByAccount(customerAccountId: CustomerAccountId): Promise<number>;
  listForStaff(
    filter: ListCreditPurchasesStaffFilter,
  ): Promise<{ readonly items: readonly CreditPurchase[]; readonly total: number }>;
  /** One keyset batch of expired PENDING purchases, so the job never holds the whole backlog. */
  listExpiredPendingBatch(
    now: Date,
    after: ExpiredPurchaseCursor | null,
    limit: number,
  ): Promise<ExpiredPurchaseBatch>;
}

/** Position of the last row of a batch; the next batch starts strictly after it. */
export interface ExpiredPurchaseCursor {
  readonly expiresAt: Date;
  readonly creditPurchaseId: CreditPurchaseId;
}

export interface ExpiredPurchaseBatch {
  readonly items: readonly CreditPurchase[];
  /** null when this was the last batch. */
  readonly nextCursor: ExpiredPurchaseCursor | null;
}
