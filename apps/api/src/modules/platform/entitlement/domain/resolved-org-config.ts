import type {
  LimitMap,
  MenuEntry,
  ModuleKey,
  OfferingKind,
  SubscriptionStatus,
} from "@banijjik/contracts";

/** The subscription fields the access mode is computed from; kept in the cached config. */
export interface SubscriptionSnapshot {
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEnd: Date | null;
}

/**
 * The effective configuration of one organization (10-MODULE-CATALOG section 3). The access mode
 * is not stored here: it is computed from `subscription` on every read, so a cached config never
 * goes stale at a trial end or a grace boundary.
 */
export interface ResolvedOrgConfig {
  readonly organizationId: string;
  readonly configVersion: number;
  readonly registryHash: string;
  readonly modules: readonly ModuleKey[];
  readonly kinds: readonly OfferingKind[];
  readonly limits: LimitMap;
  readonly menu: readonly MenuEntry[];
  readonly botTools: readonly string[];
  readonly storefrontSections: readonly string[];
  /** Empty until the settings module (card 2.4). */
  readonly settings: Readonly<Record<string, unknown>>;
  /** Empty until custom fields (card 2.3). */
  readonly fields: Readonly<Record<string, unknown>>;
  /** Empty until terms (card 2.4). */
  readonly terms: Readonly<Record<string, string>>;
  readonly subscription: SubscriptionSnapshot | undefined;
  /** From this instant the cached copy is stale (an override expires). Null when nothing expires. */
  readonly validUntil: Date | null;
}
