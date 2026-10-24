/** Events of the commission module (`<module>.<entity>.<pastTenseVerb>`, ADR-135). */
export const COMMISSION_EVENT_TYPE = Object.freeze({
  ENTRY_RECORDED: "commission.entry.recorded",
  PAYOUT_PAID: "commission.payout.paid",
} as const);

export type CommissionEventType =
  (typeof COMMISSION_EVENT_TYPE)[keyof typeof COMMISSION_EVENT_TYPE];

export interface CommissionEntryRecordedPayload {
  readonly commissionEntryId: string;
}

export interface CommissionPayoutPaidPayload {
  readonly commissionPayoutId: string;
}
