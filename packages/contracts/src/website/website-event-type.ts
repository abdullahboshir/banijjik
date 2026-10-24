/** Events of the website module (`<module>.<entity>.<pastTenseVerb>`, ADR-144). */
export const WEBSITE_EVENT_TYPE = Object.freeze({
  PAGE_UPDATED: "website.page.updated",
} as const);

export type WebsiteEventType = (typeof WEBSITE_EVENT_TYPE)[keyof typeof WEBSITE_EVENT_TYPE];
