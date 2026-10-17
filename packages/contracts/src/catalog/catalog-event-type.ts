/** Events of the catalog module (`<module>.<entity>.<pastTenseVerb>`). Payloads carry ids only. */
export const CATALOG_EVENT_TYPE = Object.freeze({
  OFFERING_CREATED: "catalog.offering.created",
  OFFERING_UPDATED: "catalog.offering.updated",
  OFFERING_PUBLISHED: "catalog.offering.published",
  OFFERING_ARCHIVED: "catalog.offering.archived",
  /** Fires when any variant price changes. */
  OFFERING_PRICE_CHANGED: "catalog.offering.priceChanged",
} as const);

export type CatalogEventType = (typeof CATALOG_EVENT_TYPE)[keyof typeof CATALOG_EVENT_TYPE];
