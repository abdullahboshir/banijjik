import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { JOURNAL_SOURCE_TYPE, POSTING_KEY } from "@banijjik/contracts/accounting";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { draftExpensePosted, draftExpenseVoided } from "../../domain/posting-rules.js";
import type { ExpensePostingSource } from "../ports/expense-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

export function buildPostExpensesHandler(input: {
  readonly expenses: ExpensePostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof EVENT_TYPE.EXPENSE_POSTED> {
  return {
    handlerKey: "accounting.postExpenses",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.EXPENSE_POSTED,
    alsoHandles: [EVENT_TYPE.EXPENSE_VOIDED],
    ordering: "ORDERED",
    streamPrefixes: ["expenseAccount:"],
    async handle(envelope) {
      await handleExpenseEvent(input, envelope as unknown as EventEnvelope<{ expenseId: string }>);
    },
  };
}

async function handleExpenseEvent(
  input: {
    readonly expenses: ExpensePostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<{ expenseId: string }>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);
  const expenseId = envelope.payload.expenseId;
  const snapshot = await input.expenses.readExpense(expenseId);
  if (snapshot === undefined) throw postingSourceMissing(`expense:${expenseId}`);

  if (envelope.type === EVENT_TYPE.EXPENSE_POSTED) {
    await postJournalEntry(input.posting, {
      organizationId,
      actorUserId,
      draft: draftExpensePosted(snapshot),
    });
    return;
  }

  const original = await input.posting.journals.findBySource({
    sourceType: JOURNAL_SOURCE_TYPE.EXPENSE,
    sourceId: expenseId,
    postingKey: POSTING_KEY.expense_posted,
  });
  if (original === undefined) throw postingSourceMissing(`expense-posted:${expenseId}`);
  await postJournalEntry(input.posting, {
    organizationId,
    actorUserId,
    draft: draftExpenseVoided(
      snapshot,
      original.lines.map((line) => ({
        accountCode: line.accountCode,
        debit: line.debit,
        credit: line.credit,
      })),
      original.journalEntryId,
    ),
  });
}
