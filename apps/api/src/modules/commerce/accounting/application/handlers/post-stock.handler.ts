import { MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { SYSTEM_ACCOUNT_CODE } from "@banijjik/contracts/accounting";
import {
  INVENTORY_EVENT_TYPE,
  type InventoryStockSourceRecordedPayload,
} from "@banijjik/contracts/inventory";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { draftStockSource } from "../../domain/stock-posting-rules.js";
import { ensureSystemAccount } from "../ensure-payable-account.js";
import type { StockPostingSource } from "../ports/stock-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

export function buildPostStockHandler(input: {
  readonly stocks: StockPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof INVENTORY_EVENT_TYPE.STOCK_SOURCE_RECORDED> {
  return {
    handlerKey: "accounting.postStock",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: INVENTORY_EVENT_TYPE.STOCK_SOURCE_RECORDED,
    ordering: "UNORDERED",
    async handle(envelope) {
      await handleStockSourceRecorded(
        input,
        envelope as unknown as EventEnvelope<InventoryStockSourceRecordedPayload>,
      );
    },
  };
}

async function handleStockSourceRecorded(
  input: {
    readonly stocks: StockPostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<InventoryStockSourceRecordedPayload>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);

  const snapshot = await input.stocks.readStockSource({
    organizationId,
    sourceType: envelope.payload.sourceType,
    sourceId: envelope.payload.sourceId,
  });
  if (snapshot === undefined) {
    throw postingSourceMissing(`stock:${envelope.payload.sourceType}:${envelope.payload.sourceId}`);
  }

  // Ensure ACCOUNTS_PAYABLE exists on the organization if any movement was bought on credit
  if (snapshot.movements.some((m) => m.paidVia === "ON_CREDIT")) {
    await ensureSystemAccount(
      { accounts: input.posting.accounts, clock: input.posting.clock },
      { organizationId, accountCode: SYSTEM_ACCOUNT_CODE.ACCOUNTS_PAYABLE },
    );
  }

  for (const draft of draftStockSource(snapshot)) {
    await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
  }
}
