import { type JournalEntryResponse } from "@banijjik/contracts/accounting";
import type { JournalEntryId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AccountRepository } from "../../accounting/application/ports/account-repository.js";
import type { JournalRepository } from "../../accounting/application/ports/journal-repository.js";
import { postReversal, toJournalResponse } from "../../accounting/application/post-journal.js";
import { entryAlreadyReversed } from "../domain/errors.js";

export interface ReverseEntryInput {
  readonly organizationId: OrganizationId;
  readonly journalEntryId: JournalEntryId;
  readonly businessDate: string;
  readonly actorUserId: UserId | null;
}

export interface ReverseEntryDependencies {
  readonly accounts: AccountRepository;
  readonly journals: JournalRepository;
  readonly events: { publish(type: string, payload: unknown): Promise<void> };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export class ReverseEntryUseCase {
  constructor(private readonly deps: ReverseEntryDependencies) {}

  async execute(input: ReverseEntryInput): Promise<JournalEntryResponse> {
    const original = await this.deps.journals.findById(input.journalEntryId);
    if (original === undefined) {
      throw new Error("Journal entry not found");
    }

    if (original.organizationId !== input.organizationId) {
      throw new Error("Journal entry belongs to another organization");
    }

    if (original.reversesJournalEntryId !== null) {
      throw entryAlreadyReversed();
    }

    const reversal = await postReversal(
      {
        accounts: this.deps.accounts,
        journals: this.deps.journals,
        events: this.deps.events,
        audit: this.deps.audit,
        clock: this.deps.clock,
      },
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        original,
        postingKey: `reversal:${input.journalEntryId}` as const,
        businessDate: input.businessDate,
      },
    );

    return toJournalResponse(reversal);
  }
}
