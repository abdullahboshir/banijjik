import type { MenuEntry } from "../modules/module-manifest.js";
import type { ModuleKey } from "../modules/module-key.js";
import type { OfferingKind } from "../modules/offering-kind.js";
import type { PermissionKey } from "../iam/permission-key.js";
import type { AccessMode } from "./access-mode.js";
import type { LimitMap } from "./limit-key.js";

/** The permissions of the caller in the shape the admin app reads (14-API section 4). */
export interface CallerPermissionsResponse {
  /** Keys granted at every location. */
  readonly allLocations: readonly PermissionKey[];
  /** Keys granted at one specific location, by location ID. */
  readonly byLocation: Readonly<Record<string, readonly PermissionKey[]>>;
}

/**
 * Response of `GET /orgs/{organizationId}/me/config`: what the admin app needs to draw itself.
 * `settings` and `terms` stay empty objects until the settings module (card 2.4).
 */
export interface ResolvedOrgConfigResponse {
  readonly organizationId: string;
  readonly configVersion: number;
  readonly registryHash: string;
  readonly accessMode: AccessMode;
  /** True while a PAST_DUE organization is still inside its grace period: show the banner. */
  readonly isPastDue: boolean;
  readonly modules: readonly ModuleKey[];
  readonly kinds: readonly OfferingKind[];
  readonly limits: LimitMap;
  readonly menu: readonly MenuEntry[];
  readonly terms: Readonly<Record<string, string>>;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly permissions: CallerPermissionsResponse;
}
