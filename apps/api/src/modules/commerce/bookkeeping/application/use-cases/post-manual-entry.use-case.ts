import { ACCOUNT_STATUS, JOURNAL_SOURCE_TYPE, type Money } from "@banijjik/contracts/accounting";
import { asId, newId, type LocationId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { AccountRepository } from "../../accounting/application/ports/account-repository.js";
import type { JournalRepository } from "../../accounting/application/ports/journal-repository.js";
import { postJournalEntry, toJournalResponse } from "../../accounting/application/post-journal.js";
import type { DraftJournalEntry } from "../../accounting/domain/journal-lines.js";
import { accountArchived, futureBusinessDate } from "../domain/errors.js";

export interface ManualEntryLine {
  readonly accountId: string;
  readonly debit?: Money | undefined;
  readonly credit?: Money | undefined;
}

export interface PostManualEntryInput {
  readonly organizationId: OrganizationId;
  readonly businessDate: string;
  readonly locationId?: string | undefined;
  readonly memo: string;
  readonly lines: readonly ManualEntryLine[];
  readonly actorUserId: UserId | null;
}

export interface PostManualEntryDependencies {
  readonly accounts: AccountRepository;
  readonly journals: JournalRepository;
  readonly events: { publish(type: string, payload: unknown): Promise<void> };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export class PostManualEntryUseCase {
  constructor(private readonly deps: PostManualEntryDependencies) {}

  async execute(input: PostManualEntryInput): Promise<JournalEntryResponse> {
    const today = this.deps.clock.now().toISOString().split("T")[0];
    if (input.businessDate > today) {
      throw futureBusinessDate();
    }

    const draftLines: DraftJournalEntry["lines"] = [];
    for (const line of input.lines) {
      const account = await this.deps.accounts.findById(asId(line.accountId));
      if (account === undefined) {
        throw new Error("Account not found");
      }

      if (account.organizationId !== input.organizationId) {
        throw new Error("Account belongs to another organization");
      }

      if (account.status === ACCOUNT_STATUS.ARCHIVED) {
        throw accountArchived();
      }

      draftLines.push({
        accountCode: account.accountCode,
        debit: line.debit ?? { amount: 0, currency: "BDT" },
        credit: line.credit ?? { amount: 0, currency: "BDT" },
      });
    }

    const postingKey = `manual:${newId()}` as const;

    const draft: DraftJournalEntry = {
      businessDate: input.businessDate,
      locationId: input.locationId === undefined ? null : asId<LocationId>(input.locationId),
      sourceType: JOURNAL_SOURCE_TYPE.MANUAL,
      sourceId: input.memo,
      postingKey,
      lines: draftLines,
    };

    const entry = await postJournalEntry(
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
        draft,
      },
    );

    return toJournalResponse(entry);
  }
}
