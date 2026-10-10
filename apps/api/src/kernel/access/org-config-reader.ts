import type { AccessMode, ModuleKey } from "@banijjik/contracts";

/** What the entitlement gate needs to know about the active organization. */
export interface GateOrgConfig {
  readonly accessMode: AccessMode;
  /** The effective modules: SYSTEM always, the rest as resolved (10-MODULE-CATALOG section 3). */
  readonly modules: readonly ModuleKey[];
}

/**
 * Port implemented by platform/entitlement: the resolved configuration of the organization of the
 * current request. It reads the organization and its config version from the request context.
 */
export interface OrgConfigReader {
  current(): Promise<GateOrgConfig>;
}
