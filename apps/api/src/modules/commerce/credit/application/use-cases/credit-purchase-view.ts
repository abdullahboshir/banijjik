import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import type { CreditPurchase } from "../../domain/credit-purchase.entity.js";

export function viewCreditPurchase(purchase: CreditPurchase): CreditPurchaseResponse {
  return {
    creditPurchaseId: purchase.creditPurchaseId,
    purchaseNumber: purchase.purchaseNumber,
    customerAccountId: purchase.customerAccountId,
    creditPackId: purchase.creditPackId,
    snapshot: purchase.snapshot,
    method: purchase.method,
    senderPhoneE164: purchase.senderPhoneE164,
    transactionReference: purchase.transactionReference,
    status: purchase.status,
    verifiedByUserId: purchase.verifiedByUserId,
    verifiedAt: purchase.verifiedAt ? purchase.verifiedAt.toISOString() : null,
    rejectionReason: purchase.rejectionReason,
    creditEntryId: purchase.creditEntryId,
    submittedAt: purchase.submittedAt.toISOString(),
    expiresAt: purchase.expiresAt.toISOString(),
    version: purchase.version,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}
