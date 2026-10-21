import type { ContactRole } from "../contact/contact-role.js";
import type { EffectiveCustomField } from "../custom-field/custom-field-contracts.js";
import type { MenuEntry } from "../modules/module-manifest.js";
import type { ModuleKey } from "../modules/module-key.js";
import type { OfferingKind } from "../modules/offering-kind.js";
import type { IndustryTemplateResourceType, LocalizedText } from "../platform/industry-template.js";
import type { PermissionKey } from "../iam/permission-key.js";
import type { AccessMode } from "./access-mode.js";
import type { LimitMap } from "./limit-key.js";
import type { SubscriptionStatus } from "./subscription-status.js";

/** The permissions of the caller in the shape the admin app reads (14-API section 4). */
export interface CallerPermissionsResponse {
  /** Keys granted at every location. */
  readonly allLocations: readonly PermissionKey[];
  /** Keys granted at one specific location, by location ID. */
  readonly byLocation: Readonly<Record<string, readonly PermissionKey[]>>;
}

/** What the admin banners need from the subscription (13-UX section 5). No new data: these fields already exist. */
export interface SubscriptionSummaryResponse {
  readonly status: SubscriptionStatus;
  /** ISO 8601 UTC; null when the subscription has no trial end. */
  readonly trialEndsAt: string | null;
  readonly isPastDue: boolean;
}

/** One permission of an effective module, as its manifest declares it: the role editor groups and marks by it. */
export interface PermissionDefinitionResponse {
  readonly permissionKey: PermissionKey;
  readonly labelKey: string;
  readonly isSensitive: boolean;
  readonly moduleKey: string;
}

/**
 * Response of `GET /orgs/{organizationId}/me/config`: what the admin app needs to draw itself.
 * `terms`, client-visible organization settings and effective fields come from one resolution (ADR-104).
 */
export interface ResolvedOrgConfigResponse {
  readonly organizationId: string;
  readonly configVersion: number;
  readonly registryHash: string;
  readonly accessMode: AccessMode;
  /** True while a PAST_DUE organization is still inside its grace period: show the banner. */
  readonly isPastDue: boolean;
  /** Null when the organization has no open subscription. */
  readonly subscription: SubscriptionSummaryResponse | null;
  readonly modules: readonly ModuleKey[];
  readonly kinds: readonly OfferingKind[];
  readonly limits: LimitMap;
  readonly menu: readonly MenuEntry[];
  readonly terms: Readonly<Record<string, LocalizedText>>;
  readonly settings: Readonly<Record<string, unknown>>;
  /** Effective custom fields, keyed by entity type. Empty when no effective module declares one. */
  readonly fields: Readonly<Record<string, readonly EffectiveCustomField[]>>;
  /** The contact roles the template allows: a contact form offers these (ADR-113). */
  readonly contactRoleKeys: readonly ContactRole[];
  /** Template resource choices; absent in config cached before card 3.6. */
  readonly resourceTypes?: readonly IndustryTemplateResourceType[];
  readonly permissions: CallerPermissionsResponse;
  /** Every permission of the effective modules, so a client never hard-codes which ones are sensitive. */
  readonly permissionDefinitions: readonly PermissionDefinitionResponse[];
}
