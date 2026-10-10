import type { Clock } from "../../../kernel/time/index.js";
import type { PackageReader } from "./application/ports/package-repository.js";
import { EnsureSeedPackagesUseCase } from "./application/use-cases/ensure-seed-packages.use-case.js";
import { MongoPackageRepository } from "./infrastructure/mongo-package.repository.js";
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
