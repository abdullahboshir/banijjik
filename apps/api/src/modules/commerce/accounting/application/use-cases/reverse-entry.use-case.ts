import type { JournalEntryResponse } from "@banijjik/contracts/accounting";
import type { JournalEntryId, OrganizationId, UserId } from "@banijjik/ids";
import { notFound } from "../../../../../kernel/http/index.js";
import { postReversal, toJournalResponse } from "../post-journal.js";
import { entryAlreadyReversed, futureBusinessDate } from "../../domain/bookkeeping-errors.js";
import {
  assertJournalLocation,
  consumeJournalApproval,
  type PostManualEntryDependencies,
} from "./post-manual-entry.use-case.js";
export interface ReverseEntryInput {
  readonly organizationId: OrganizationId;
  readonly journalEntryId: JournalEntryId;
  readonly businessDate: string;
  readonly approvalToken?: string | undefined;
  readonly actorUserId: UserId;
  readonly allowedLocationIds: readonly string[] | "ALL";
}
export class ReverseEntryUseCase {
  constructor(private readonly deps: PostManualEntryDependencies) {}
  async execute(input: ReverseEntryInput): Promise<JournalEntryResponse> {
    if (input.businessDate > this.deps.clock.now().toISOString().slice(0, 10))
      throw futureBusinessDate();
    return this.deps.unitOfWork.run(async () => {
      const original = await this.deps.journals.findById(input.journalEntryId);
      if (original === undefined || original.organizationId !== input.organizationId)
        throw notFound();
      await assertJournalLocation(
        this.deps,
        original.locationId ?? undefined,
        input.allowedLocationIds,
      );
      const postingKey = `reversal:${input.journalEntryId}` as const;
      const existing = await this.deps.journals.findBySource({
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        postingKey,
      });
      if (existing !== undefined) throw entryAlreadyReversed();
      await consumeJournalApproval(this.deps, {
        organizationId: input.organizationId,
        requestedByUserId: input.actorUserId,
        locationId: original.locationId ?? "ALL",
        token: input.approvalToken,
        subjectKey: `reverse:${input.journalEntryId}:${input.businessDate}`,
        amount: original.lines.reduce((sum, line) => sum + line.debit.amount, 0),
      });
      return toJournalResponse(
        await postReversal(this.deps, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          original,
          postingKey,
          businessDate: input.businessDate,
          rejectExisting: true,
        }),
      );
    });
  }
}
