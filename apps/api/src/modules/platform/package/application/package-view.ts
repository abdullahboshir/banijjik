import type { LimitMap, ModuleKey, PackageStatus } from "@banijjik/contracts";
import type { LimitIncrements } from "../domain/package.entity.js";

/** What other modules (entitlement, saas-billing) may read of a package. */
export interface PackageView {
  readonly packageId: string;
  readonly packageKey: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly ModuleKey[];
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
  readonly status: PackageStatus;
  readonly version: number;
}

/** One ACTIVE package at one version; the catalogue version is a hash of all of these. */
export interface PackageVersionStamp {
  readonly packageId: string;
  readonly version: number;
}
