import { asId, type PackageId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import type { PackageVersionStamp, PackageView } from "../application/package-view.js";
import { Package } from "../domain/package.entity.js";
import type { PackageDocument } from "./package.schema.js";

/** `actorUserId` is the operator who created the package; the seed writes it as the system (null). */
export function toPackageDocument(entity: Package, actorUserId?: UserId): PackageDocument {
  return {
    packageId: entity.packageId,
    packageKey: entity.packageKey,
    nameKey: entity.nameKey,
    isAddOn: entity.isAddOn,
    moduleKeys: [...entity.moduleKeys],
    limits: { ...entity.limits },
    limitIncrements: { ...entity.limitIncrements },
    status: entity.status,
    version: entity.version,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    createdByUserId: actorUserId ?? null,
    updatedByUserId: null,
  };
}

export function toPackage(document: PackageDocument): Package {
  const stored = stripMongoInternals(document);
  return Package.restore({
    packageId: asId<PackageId>(stored.packageId),
    packageKey: stored.packageKey,
    nameKey: stored.nameKey,
    isAddOn: stored.isAddOn,
    moduleKeys: stored.moduleKeys,
    limits: stored.limits,
    // Missing on a package saved without increments: Mongoose drops an empty sub-document.
    limitIncrements: stored.limitIncrements ?? {},
    status: stored.status,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}

export function toPackageView(document: PackageDocument): PackageView {
  const entity = toPackage(document);
  return {
    packageId: entity.packageId,
    packageKey: entity.packageKey,
    isAddOn: entity.isAddOn,
    moduleKeys: entity.moduleKeys,
    limits: entity.limits,
    limitIncrements: entity.limitIncrements,
    status: entity.status,
    version: entity.version,
  };
}

export function toVersionStamp(
  document: Pick<PackageDocument, "packageId" | "version">,
): PackageVersionStamp {
  return { packageId: document.packageId, version: document.version };
}
