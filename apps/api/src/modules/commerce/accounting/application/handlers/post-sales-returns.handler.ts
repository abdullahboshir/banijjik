import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { draftSalesReturn } from "../../domain/sales-return-posting-rules.js";
import type { SalesReturnPostingSource } from "../ports/sales-return-posting-source.js";
import { postJournalEntry, postReversal, type PostJournalDependencies } from "../post-journal.js";
import {
  JOURNAL_SOURCE_TYPE,
  POSTING_KEY,
  reversalPostingKeyFor,
} from "@banijjik/contracts/accounting";

/** Posts a return once per (SALES_RETURN, salesReturnId, postingKey); a redelivered event changes nothing. */
export function buildPostSalesReturnsHandler(input: {
  readonly salesReturns: SalesReturnPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof EVENT_TYPE.SALES_RETURN_CREATED> {
  return {
    handlerKey: "accounting.postSalesReturns",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.SALES_RETURN_CREATED,
    alsoHandles: [EVENT_TYPE.SALES_RETURN_REVERSED],
    ordering: "ORDERED",
    streamPrefixes: ["order:"],
    async handle(envelope) {
      await handleSalesReturnEvent(
        input,
        envelope as unknown as EventEnvelope<{ salesReturnId: string; orderId: string }>,
      );
    },
  };
}

async function handleSalesReturnEvent(
  input: {
    readonly salesReturns: SalesReturnPostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<{ salesReturnId: string; orderId: string }>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);
  const snapshot = await input.salesReturns.readSalesReturn(envelope.payload.salesReturnId);
  if (snapshot === undefined) {
    throw postingSourceMissing(`sales-return:${envelope.payload.salesReturnId}`);
  }
  if (envelopeTypeIsReversal(envelope)) {
    const reversalBusinessDate = snapshot.reversalBusinessDate;
    if (reversalBusinessDate === null) {
      throw postingSourceMissing(`sales-return-reversal:${snapshot.salesReturnId}`);
    }
    for (const postingKey of [POSTING_KEY.sales_return_value, POSTING_KEY.sales_return_cogs]) {
      const original = await input.posting.journals.findBySource({
        sourceType: JOURNAL_SOURCE_TYPE.SALES_RETURN,
        sourceId: snapshot.salesReturnId,
        postingKey,
      });
      if (original === undefined) continue;
      await postReversal(input.posting, {
        organizationId,
        actorUserId,
        original,
        postingKey: reversalPostingKeyFor(postingKey),
        businessDate: reversalBusinessDate,
      });
    }
    return;
  }
  for (const draft of draftSalesReturn(snapshot)) {
    await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
  }
}

function envelopeTypeIsReversal(
  envelope: EventEnvelope<{ readonly salesReturnId: string; readonly orderId: string }>,
): boolean {
  return envelope.type === EVENT_TYPE.SALES_RETURN_REVERSED;
}
