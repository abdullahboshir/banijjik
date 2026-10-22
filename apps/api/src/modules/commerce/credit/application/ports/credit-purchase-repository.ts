import type { CreditPurchaseMethod, CreditPurchaseStatus } from "@banijjik/contracts/credit";
import type { CreditPurchaseId, CustomerAccountId } from "@banijjik/ids";
import type { CreditPurchase } from "../../domain/credit-purchase.entity.js";

export interface ListCreditPurchasesStaffFilter {
  readonly status?: CreditPurchaseStatus | undefined;
  readonly q?: string | undefined;
  readonly offset: number;
  readonly limit: number;
}

export interface CreditPurchaseRepository {
  insert(purchase: CreditPurchase): Promise<void>;
  updateVersioned(purchase: CreditPurchase): Promise<boolean>;
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
  listExpiredPending(now: Date): Promise<readonly CreditPurchase[]>;
}
