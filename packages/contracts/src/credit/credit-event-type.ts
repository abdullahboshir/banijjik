/** Events of the credit module (`<module>.<entity>.<pastTenseVerb>`, ADR-130). */
export const CREDIT_EVENT_TYPE = Object.freeze({
  CREDIT_ENTRY_CREATED: "credit.entry.created",
  UNLOCK_CREATED: "credit.unlock.created",
  PURCHASE_SUBMITTED: "credit.purchase.submitted",
  PURCHASE_VERIFIED: "credit.purchase.verified",
  PURCHASE_REJECTED: "credit.purchase.rejected",
  PURCHASE_CANCELLED: "credit.purchase.cancelled",
} as const);

export type CreditEventType = (typeof CREDIT_EVENT_TYPE)[keyof typeof CREDIT_EVENT_TYPE];
