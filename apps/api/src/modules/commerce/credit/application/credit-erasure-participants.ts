import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CUSTOMER_DATA_EXPORT_SECTION_KEY,
  type CreditExportSection,
} from "@banijjik/contracts/contact";
import { CREDIT_EVENT_TYPE } from "@banijjik/contracts/credit";
import type {
  CustomerDataExportParticipant,
  CustomerErasureParticipant,
} from "../../contact/index.js";
import type { CreditDependencies } from "./ports/credit-dependencies.js";

export function buildCreditErasureParticipant(
  dependencies: Pick<CreditDependencies, "credit" | "purchases" | "audit" | "events">,
): CustomerErasureParticipant {
  return {
    async eraseForAccount(input) {
      const accountId = input.customerAccountId;
      const balance = await dependencies.credit.getBalance(accountId);
      const pendingPurchases = await dependencies.purchases.listPendingByAccount(accountId);
      for (const purchase of pendingPurchases) {
        const cancelled = purchase.cancel(input.now);
        await dependencies.purchases.updateVersioned(cancelled, null);
        await dependencies.audit.record({
          action: AUDIT_ACTION.CREDIT_PURCHASE_CANCELLED,
          entityType: AUDIT_ENTITY_TYPE.creditPurchase,
          entityId: cancelled.creditPurchaseId,
          changes: {
            status: { from: purchase.status, to: cancelled.status },
          },
        });
        await dependencies.events.publish(
          CREDIT_EVENT_TYPE.PURCHASE_CANCELLED,
          { creditPurchaseId: cancelled.creditPurchaseId },
          { orderingKey: `creditAccount:${cancelled.customerAccountId}` },
        );
      }
      return { forfeitedCredits: balance?.balance ?? 0 };
    },
  };
}

export function buildCreditExportParticipant(
  dependencies: Pick<CreditDependencies, "credit" | "unlocks" | "purchases">,
): CustomerDataExportParticipant {
  return {
    sectionKey: CUSTOMER_DATA_EXPORT_SECTION_KEY.CREDIT,
    async exportForAccount(input): Promise<CreditExportSection> {
      const accountId = input.customerAccountId;
      const fetchLimit = input.maxRows + 1;

      const [balanceRecord, rawEntries, rawUnlocks, pagedPurchases] = await Promise.all([
        dependencies.credit.getBalance(accountId),
        dependencies.credit.listEntries(accountId, { offset: 0, limit: fetchLimit }),
        dependencies.unlocks.listByCustomer(accountId, { offset: 0, limit: fetchLimit }),
        dependencies.purchases.listByAccount(accountId, 0, fetchLimit),
      ]);

      const entriesTruncated = rawEntries.length > input.maxRows;
      const slicedEntries = entriesTruncated ? rawEntries.slice(0, input.maxRows) : rawEntries;

      const unlocksTruncated = rawUnlocks.length > input.maxRows;
      const slicedUnlocks = unlocksTruncated ? rawUnlocks.slice(0, input.maxRows) : rawUnlocks;

      const purchasesTruncated = pagedPurchases.items.length > input.maxRows;
      const slicedPurchases = purchasesTruncated
        ? pagedPurchases.items.slice(0, input.maxRows)
        : pagedPurchases.items;

      return {
        sectionKey: CUSTOMER_DATA_EXPORT_SECTION_KEY.CREDIT,
        balance: balanceRecord?.balance ?? 0,
        entries: slicedEntries.map((e) => ({
          creditEntryId: e.creditEntryId,
          type: e.type,
          credits: e.credits,
          reason: e.reason,
          createdAt: e.createdAt,
        })),
        entriesTruncated,
        unlocks: slicedUnlocks.map((u) => ({
          listingUnlockId: u.listingUnlockId,
          listingId: u.listingId,
          unlockedAt: u.unlockedAt,
        })),
        unlocksTruncated,
        purchases: slicedPurchases.map((p) => ({
          creditPurchaseId: p.creditPurchaseId,
          creditPackId: p.creditPackId,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
        purchasesTruncated,
        truncated: entriesTruncated || unlocksTruncated || purchasesTruncated,
      };
    },
  };
}
