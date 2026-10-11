import type { ModuleManifest, PackageStatus } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { Package } from "../../domain/package.entity.js";
import type { PackageVersionStamp, PackageView } from "../package-view.js";

export interface PackageRepository {
  insert(newPackage: Package): Promise<void>;
  /** The package keys that already exist, so the seed adds only the missing ones. */
  findExistingKeys(packageKeys: readonly string[]): Promise<ReadonlySet<string>>;
}

/** The read side other modules use, in one place. Packages are platform data (tenancy NONE). */
export interface PackageReader {
  findByIds(packageIds: readonly string[]): Promise<readonly PackageView[]>;
  findActiveBaseByKey(packageKey: string): Promise<PackageView | undefined>;
  listActiveVersions(): Promise<readonly PackageVersionStamp[]>;
}

export interface PackageListQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: PackageStatus | undefined;
}

export interface PackagePage {
  readonly items: readonly Package[];
  readonly hasNext: boolean;
}

/** The platform panel's side of the package store (card 1.8a). */
export interface PackageAdminRepository {
  /** Throws DuplicatePackageKeyError when the key is taken, including by a concurrent insert. */
  insert(newPackage: Package, actorUserId: UserId): Promise<void>;
  findById(packageId: string): Promise<Package | undefined>;
  list(query: PackageListQuery): Promise<PackagePage>;
  /** Saves the changed fields and moves `version` if the stored version is still `expectedVersion`, else a 409. */
  update(updated: Package, expectedVersion: number, actorUserId: UserId): Promise<Package>;
}

/** Is a package used by a subscription that is still running? Implemented by saas-billing, wired in routes/v1.ts. */
export interface PackageUsage {
  isInUse(packageId: string): Promise<boolean>;
}

/** The registered manifests, for the closure rule. Supplied by routes/v1.ts from the module registry. */
export interface ManifestCatalog {
  all(): readonly ModuleManifest[];
}
