import type { Clock } from "../../../../../kernel/time/index.js";
import { Package } from "../../domain/package.entity.js";
import type { PackageRepository } from "../ports/package-repository.js";
import type { SeedPackage } from "../seed-package.js";

export interface EnsureSeedPackagesDependencies {
  readonly packages: PackageRepository;
  readonly seed: readonly SeedPackage[];
  readonly clock: Clock;
}

export interface EnsureSeedPackagesResult {
  readonly createdCount: number;
}

/**
 * Inserts the seed packages that are missing and leaves every existing one alone, so an edit made
 * in the platform panel survives a re-run (card 1.6a). Running it twice gives the same documents.
 */
export class EnsureSeedPackagesUseCase {
  constructor(private readonly dependencies: EnsureSeedPackagesDependencies) {}

  async execute(): Promise<EnsureSeedPackagesResult> {
    const { packages, seed, clock } = this.dependencies;
    const existing = await packages.findExistingKeys(seed.map((entry) => entry.packageKey));
    const missing = seed.filter((entry) => !existing.has(entry.packageKey));
    for (const entry of missing) {
      await packages.insert(
        Package.create({ ...entry, nameKey: `package.${entry.packageKey}.name`, now: clock.now() }),
      );
    }
    return { createdCount: missing.length };
  }
}
