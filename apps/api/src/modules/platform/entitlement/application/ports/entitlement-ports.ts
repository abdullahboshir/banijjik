import type {
  ContactRole,
  IndustryTemplateResourceType,
  IndustryTemplateKey,
  ModuleKey,
  OfferingKind,
} from "@banijjik/contracts";
import type { ModuleOverrideRecord } from "../../domain/module-override.js";

/** The overrides of one organization, expired ones included: the resolver decides what is active. */
export interface ModuleOverrideReader {
  findAll(organizationId: string): Promise<readonly ModuleOverrideRecord[]>;
}

/** What the resolver needs from an industry template (09 section 4.6). */
export interface IndustryTemplateView {
  readonly allowedModuleKeys: readonly ModuleKey[];
  /** The roles a contact of this template may have (ADR-113). */
  readonly contactRoleKeys: readonly ContactRole[];
  /** Template resource choices; absent in config cached before card 3.6. */
  readonly resourceTypes?: readonly IndustryTemplateResourceType[];
  readonly enabledKinds: readonly OfferingKind[];
  readonly templateVersion: number;
}

/**
 * Port to platform/industry (card 2.1). An implementation must make `find` cheap on a hot path
 * (the config cache key reads `templateVersion` on every request), for example with a short cache.
 */
export interface IndustryTemplateReader {
  find(industryTemplateKey: IndustryTemplateKey): Promise<IndustryTemplateView>;
}

/** The template key and the config version of an organization. Adapted from core/organization in routes/v1.ts. */
export interface OrganizationConfigSnapshot {
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly configVersion: number;
}

export interface OrganizationConfigSource {
  find(organizationId: string): Promise<OrganizationConfigSnapshot | undefined>;
}

/**
 * Port to core/organization: the number of ACTIVE locations, for menu entries that show only with
 * two or more (`MenuEntry.visibility`). Adapted in routes, because the count runs in the
 * organization's tenant context.
 */
export interface ActiveLocationCounter {
  countActive(organizationId: string): Promise<number>;
}
