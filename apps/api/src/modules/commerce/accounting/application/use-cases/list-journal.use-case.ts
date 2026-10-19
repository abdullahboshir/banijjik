import type { JournalEntryResponse } from "@banijjik/contracts/accounting";
import type { JournalListQuery } from "@banijjik/validation/accounting";
import type { JournalRepository } from "../ports/journal-repository.js";
import { toJournalResponse } from "../post-journal.js";

export class ListJournalUseCase {
  constructor(private readonly journals: JournalRepository) {}

  async execute(
    query: JournalListQuery,
  ): Promise<{ readonly items: JournalEntryResponse[]; readonly hasNext: boolean }> {
    const result = await this.journals.list(query);
    return { items: result.items.map(toJournalResponse), hasNext: result.hasNext };
  }
}
