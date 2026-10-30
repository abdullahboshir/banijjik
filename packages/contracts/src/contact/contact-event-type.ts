/** Events of the contact module (`<module>.<entity>.<pastTenseVerb>`). Merge arrives with its own card. */
export const CONTACT_EVENT_TYPE = Object.freeze({
  CONTACT_CREATED: "contact.contact.created",
  CONTACT_UPDATED: "contact.contact.updated",
  CONTACT_ARCHIVED: "contact.contact.archived",
  CONTACT_ANONYMIZED: "contact.contact.anonymized",
  CUSTOMER_OTP_REQUESTED: "contact.customerOtp.requested",
  CUSTOMER_ACCOUNT_BLOCKED: "contact.customerAccount.blocked",
  CUSTOMER_ACCOUNT_UNBLOCKED: "contact.customerAccount.unblocked",
  CUSTOMER_ACCOUNT_ENDED: "contact.customerAccount.ended",
  CUSTOMER_ACCOUNT_ERASED: "contact.customerAccount.erased",
  PROVISIONAL_CREATED: "contact.provisional.created",
} as const);

export type ContactEventType = (typeof CONTACT_EVENT_TYPE)[keyof typeof CONTACT_EVENT_TYPE];
