import type { PlatformPackageResponse } from "@banijjik/contracts";
import type { PackageDetail } from "../application/use-cases/package-admin.use-cases.js";

/** The package as the platform panel sees it, with the module keys that have no manifest yet. */
export function toPackageResponse(detail: PackageDetail): PlatformPackageResponse {
  const { package: subject } = detail;
  return {
    packageId: subject.packageId,
    packageKey: subject.packageKey,
    nameKey: subject.nameKey,
    isAddOn: subject.isAddOn,
    moduleKeys: [...subject.moduleKeys],
    limits: { ...subject.limits },
    limitIncrements: { ...subject.limitIncrements },
    status: subject.status,
    version: subject.version,
    unbuiltModuleKeys: [...detail.unbuiltModuleKeys],
  };
}
