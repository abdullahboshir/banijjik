import type {
  CommissionEntryPostingSnapshot,
  CommissionPayoutPostingSnapshot,
} from "../../domain/commission-posting-rules.js";

/** Reads commission entries and payouts for journal lines. Implemented by the commission module. */
export interface CommissionPostingSource {
  readEntry(commissionEntryId: string): Promise<CommissionEntryPostingSnapshot | undefined>;
  readPayout(commissionPayoutId: string): Promise<CommissionPayoutPostingSnapshot | undefined>;
}
