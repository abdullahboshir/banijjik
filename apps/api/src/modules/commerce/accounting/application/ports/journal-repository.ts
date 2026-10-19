import type { JournalSourceType, PostingKey } from "@banijjik/contracts/accounting";
import type { JournalEntryId } from "@banijjik/ids";
import type { JournalEntry } from "../../domain/journal-entry.entity.js";

export interface JournalListFilter {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly sourceType?: JournalSourceType | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface JournalRepository {
  /** Returns "duplicate" when the idempotency unique index refuses the insert. */
  insert(entry: JournalEntry): Promise<"inserted" | "duplicate">;
  findById(journalEntryId: JournalEntryId): Promise<JournalEntry | undefined>;
  findBySource(input: {
    readonly sourceType: JournalSourceType;
    readonly sourceId: string;
    readonly postingKey: PostingKey;
  }): Promise<JournalEntry | undefined>;
  list(
    filter: JournalListFilter,
  ): Promise<{ readonly items: JournalEntry[]; readonly hasNext: boolean }>;
  /** All entries with businessDate ≤ asOf, for trial balance. */
  listThrough(asOf: string): Promise<JournalEntry[]>;
}
