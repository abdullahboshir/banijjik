import type { Router } from "express";
import type { PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type {
  ManifestCatalog,
  PackageReader,
  PackageUsage,
} from "./application/ports/package-repository.js";
import {
  ArchivePackageUseCase,
  CreatePackageUseCase,
  GetPackageUseCase,
  ListPackagesUseCase,
  UpdatePackageUseCase,
} from "./application/use-cases/package-admin.use-cases.js";
import { EnsureSeedPackagesUseCase } from "./application/use-cases/ensure-seed-packages.use-case.js";
import { MongoPackageRepository } from "./infrastructure/mongo-package.repository.js";
import { MongoUnitOfWork } from "./infrastructure/mongo-unit-of-work.js";
import { PackageController } from "./presentation/package.controller.js";
import { buildPackageRouter } from "./presentation/package.router.js";
import { SEED_PACKAGES } from "./infrastructure/seed-packages.js";

export { registerPackageModels } from "./infrastructure/register-package-models.js";
export { packageManifest } from "./module.manifest.js";
export { SEED_PACKAGES } from "./infrastructure/seed-packages.js";
export type { PackageReader } from "./application/ports/package-repository.js";
export type { PackageVersionStamp, PackageView } from "./application/package-view.js";
export type { EnsureSeedPackagesUseCase } from "./application/use-cases/ensure-seed-packages.use-case.js";

/** The read side for entitlement and saas-billing. */
export function buildPackageReader(): PackageReader {
  return new MongoPackageRepository();
}

/** The seed use case; src/seeds/seed-packages.ts runs it. */
export function buildEnsureSeedPackagesUseCase(clock: Clock): EnsureSeedPackagesUseCase {
  return new EnsureSeedPackagesUseCase({
    packages: new MongoPackageRepository(),
    seed: SEED_PACKAGES,
    clock,
  });
}

export interface PackagePlatformRouterDependencies {
  readonly clock: Clock;
  readonly permission: PlatformPermissionMiddlewareFactory;
  readonly platformAudit: PlatformAuditRecorder;
  /** The registered manifests, for the closure rule on save. */
  readonly manifests: ManifestCatalog;
  /** Implemented by saas-billing: is a package used by a running subscription? */
  readonly usage: PackageUsage;
}

export type { ManifestCatalog, PackageUsage } from "./application/ports/package-repository.js";

/** `/platform/packages`, mounted by routes/v1.ts behind `authenticatePlatform`. */
export function buildPackagePlatformRouter(
  dependencies: PackagePlatformRouterDependencies,
): Router {
  const shared = {
    packages: new MongoPackageRepository(),
    manifests: dependencies.manifests,
    usage: dependencies.usage,
    unitOfWork: new MongoUnitOfWork(),
    platformAudit: dependencies.platformAudit,
    clock: dependencies.clock,
  };
  const controller = new PackageController({
    listPackages: new ListPackagesUseCase(shared),
    getPackage: new GetPackageUseCase(shared),
    createPackage: new CreatePackageUseCase(shared),
    updatePackage: new UpdatePackageUseCase(shared),
    archivePackage: new ArchivePackageUseCase(shared),
  });
  return buildPackageRouter(controller, dependencies.permission);
}
