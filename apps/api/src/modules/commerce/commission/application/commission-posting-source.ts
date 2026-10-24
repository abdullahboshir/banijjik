import type {
  CommissionEntryPostingSnapshot,
  CommissionPayoutPostingSnapshot,
  CommissionPostingSource,
} from "../../accounting/index.js";
import { asId, type CommissionEntryId, type CommissionPayoutId } from "@banijjik/ids";
import type {
  CommissionEntryRepository,
  CommissionPayoutRepository,
} from "./ports/commission-ports.js";

/** Adapts commission entries and payouts for the accounting posting engine (import via index). */
export function buildCommissionPostingSource(input: {
  readonly entries: Pick<CommissionEntryRepository, "findById">;
  readonly payouts: Pick<CommissionPayoutRepository, "findById">;
}): CommissionPostingSource {
  return {
    async readEntry(commissionEntryId): Promise<CommissionEntryPostingSnapshot | undefined> {
      const entry = await input.entries.findById(asId<CommissionEntryId>(commissionEntryId));
      if (entry === undefined) return undefined;
      return {
        commissionEntryId: entry.commissionEntryId,
        businessDate: entry.businessDate,
        locationId: entry.locationId,
        amount: entry.amount,
        entryKind: entry.entryKind,
      };
    },
    async readPayout(commissionPayoutId): Promise<CommissionPayoutPostingSnapshot | undefined> {
      const payout = await input.payouts.findById(asId<CommissionPayoutId>(commissionPayoutId));
      if (payout === undefined) return undefined;
      return {
        commissionPayoutId: payout.commissionPayoutId,
        businessDate: payout.businessDate,
        locationId: payout.locationId,
        total: payout.total,
        method: payout.method,
      };
    },
  };
}
