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
