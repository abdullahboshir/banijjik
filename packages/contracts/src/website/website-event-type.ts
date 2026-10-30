/** Events of the website module (`<module>.<entity>.<pastTenseVerb>`, ADR-144). */
export const WEBSITE_EVENT_TYPE = Object.freeze({
  PAGE_UPDATED: "website.page.updated",
  SITE_PUBLISHED: "website.site.published",
  SITE_UNPUBLISHED: "website.site.unpublished",
  DOMAIN_REQUESTED: "website.domain.requested",
  DOMAIN_VERIFICATION_REQUESTED: "website.domain.verificationRequested",
  DOMAIN_REMOVAL_REQUESTED: "website.domain.removalRequested",
  DOMAIN_STATE_CHANGED: "website.domain.stateChanged",
  GUEST_SESSION_CREATED: "website.guestSession.created",
  CHECKOUT_CREATED: "website.checkout.created",
  CHECKOUT_CLAIMED: "website.checkout.claimed",
} as const);

export type WebsiteEventType = (typeof WEBSITE_EVENT_TYPE)[keyof typeof WEBSITE_EVENT_TYPE];
