/** Events of the contact module (`<module>.<entity>.<pastTenseVerb>`). Merge arrives with its own card. */
export const CONTACT_EVENT_TYPE = Object.freeze({
  CONTACT_CREATED: "contact.contact.created",
  CONTACT_UPDATED: "contact.contact.updated",
  CONTACT_ARCHIVED: "contact.contact.archived",
  CONTACT_ANONYMIZED: "contact.contact.anonymized",
} as const);

export type ContactEventType = (typeof CONTACT_EVENT_TYPE)[keyof typeof CONTACT_EVENT_TYPE];
