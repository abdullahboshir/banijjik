import {
  JOURNAL_SOURCE_TYPE,
  METHOD_ACCOUNT_CODE,
  POSTING_KEY,
  SYSTEM_ACCOUNT_CODE,
  type Money,
} from "@banijjik/contracts/accounting";
import {
  assertBalanced,
  credit,
  debit,
  type DraftJournalEntry,
  type DraftJournalLine,
} from "./journal-lines.js";

export type SettlementReceivedVia = "CASH" | "BANK" | "BKASH" | "NAGAD";

export interface CourierSettlementPostingSnapshot {
  readonly courierSettlementId: string;
  readonly organizationId: string;
  readonly businessDate: string;
  readonly locationId: string | null;
  readonly paymentIds: readonly string[];
  readonly grossAmount: Money;
  readonly courierCharges: Money;
  readonly netReceived: Money;
  readonly receivedVia: SettlementReceivedVia;
  readonly reversesCourierSettlementId?: string | null;
}

export interface RiderHandoverPostingSnapshot {
  readonly riderCashHandoverId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly businessDate: string;
  readonly paymentIds: readonly string[];
  readonly amount: Money;
  readonly receivedVia: SettlementReceivedVia;
  readonly reversesRiderCashHandoverId?: string | null;
}

function methodAccountCode(receivedVia: SettlementReceivedVia): string {
  return METHOD_ACCOUNT_CODE[receivedVia];
}

/**
 * Drafts the journal entry clearing courier collection receivable upon settlement.
 * Dr Received Asset (Cash/Bank/MFS) [netReceived]
 * Dr COURIER_FEES [courierCharges] (if > 0)
 * Cr COURIER_RECEIVABLE [grossAmount]
 */
export function draftCourierSettlement(
  snapshot: CourierSettlementPostingSnapshot,
): DraftJournalEntry {
  const lines: DraftJournalLine[] = [
    debit(methodAccountCode(snapshot.receivedVia), snapshot.netReceived),
  ];

  if (snapshot.courierCharges.amount > 0) {
    lines.push(debit(SYSTEM_ACCOUNT_CODE.COURIER_FEES, snapshot.courierCharges));
  }

  lines.push(credit(SYSTEM_ACCOUNT_CODE.COURIER_RECEIVABLE, snapshot.grossAmount));

  assertBalanced(lines);

  return {
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.COURIER,
    sourceId: snapshot.courierSettlementId,
    postingKey: POSTING_KEY.courier_settlement,
    lines,
  };
}

/**
 * Drafts the journal entry clearing rider cash upon handover to cash register/till/bank.
 * Dr Received Asset (Cash/Bank/MFS) [amount]
 * Cr RIDER_CASH [amount]
 */
export function draftRiderHandover(snapshot: RiderHandoverPostingSnapshot): DraftJournalEntry {
  const lines: DraftJournalLine[] = [
    debit(methodAccountCode(snapshot.receivedVia), snapshot.amount),
    credit(SYSTEM_ACCOUNT_CODE.RIDER_CASH, snapshot.amount),
  ];

  assertBalanced(lines);

  return {
    businessDate: snapshot.businessDate,
    locationId: snapshot.locationId,
    sourceType: JOURNAL_SOURCE_TYPE.DELIVERY,
    sourceId: snapshot.riderCashHandoverId,
    postingKey: POSTING_KEY.rider_handover,
    lines,
  };
}
