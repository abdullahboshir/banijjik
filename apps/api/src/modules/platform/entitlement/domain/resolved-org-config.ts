import type {
  EffectiveCustomField,
  LimitMap,
  LocalizedText,
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
  /** Client-visible organization-level settings (ADR-104). */
  readonly settings: Readonly<Record<string, unknown>>;
  /** Effective custom fields keyed by entity type (ADR-104). */
  readonly fields: Readonly<Record<string, readonly EffectiveCustomField[]>>;
  /** Template terms with tenant overrides. Both languages are always present (ADR-104). */
  readonly terms: Readonly<Record<string, LocalizedText>>;
  readonly subscription: SubscriptionSnapshot | undefined;
  /** From this instant the cached copy is stale (an override expires). Null when nothing expires. */
  readonly validUntil: Date | null;
}
