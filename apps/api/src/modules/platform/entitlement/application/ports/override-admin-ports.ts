import type { ModuleKey, ModuleManifest, ModuleOverrideEffect } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";

/** An override as the platform panel reads it. */
export interface ModuleOverrideView {
  readonly moduleOverrideId: string;
  readonly organizationId: string;
  readonly moduleKey: ModuleKey;
  readonly effect: ModuleOverrideEffect;
  readonly reason: string;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

/** Overrides are tenant-scoped rows: the caller runs these under runAsSystem(PLATFORM_ADMIN). */
export interface ModuleOverrideAdminRepository {
  /** Throws DuplicateOverrideError when the (organization, module, effect) row exists. */
  insert(row: ModuleOverrideView, actorUserId: UserId): Promise<void>;
  list(organizationId: string): Promise<readonly ModuleOverrideView[]>;
  findById(
    organizationId: string,
    moduleOverrideId: string,
  ): Promise<ModuleOverrideView | undefined>;
  delete(organizationId: string, moduleOverrideId: string): Promise<void>;
}

/** Does the organization exist? Implemented by core/organization, wired in routes/v1.ts. */
export interface OrganizationExistence {
  exists(organizationId: string): Promise<boolean>;
}

export interface OverrideManifestCatalog {
  all(): readonly ModuleManifest[];
}

export interface OverrideUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
