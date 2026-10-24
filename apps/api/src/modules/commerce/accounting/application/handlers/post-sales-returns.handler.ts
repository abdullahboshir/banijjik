import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { draftSalesReturn } from "../../domain/sales-return-posting-rules.js";
import type { SalesReturnPostingSource } from "../ports/sales-return-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

/** Posts a return once per (SALES_RETURN, salesReturnId, postingKey); a redelivered event changes nothing. */
export function buildPostSalesReturnsHandler(input: {
  readonly salesReturns: SalesReturnPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof EVENT_TYPE.SALES_RETURN_CREATED> {
  return {
    handlerKey: "accounting.postSalesReturns",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.SALES_RETURN_CREATED,
    ordering: "ORDERED",
    streamPrefixes: ["order:"],
    async handle(envelope) {
      await handleSalesReturnCreated(
        input,
        envelope as unknown as EventEnvelope<{ salesReturnId: string; orderId: string }>,
      );
    },
  };
}

async function handleSalesReturnCreated(
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
  for (const draft of draftSalesReturn(snapshot)) {
    await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
  }
}
