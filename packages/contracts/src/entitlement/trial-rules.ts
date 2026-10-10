import { PACKAGE_KEY } from "./package-key.js";

/** A new organization gets 14 days of the BUNDLE package (owner decision, 10-MODULE-CATALOG section 9). */
export const TRIAL_DAYS = 14;

/** Days after a due date during which a PAST_DUE organization keeps full access (ADR-053). */
export const PAST_DUE_GRACE_DAYS = 7;

export const TRIAL_PACKAGE_KEY = PACKAGE_KEY.BUNDLE;

/** The one tenant path the entitlement gate lets through without a module owner (ADR-091). */
export const ME_CONFIG_PATH = "/orgs/:organizationId/me/config";
