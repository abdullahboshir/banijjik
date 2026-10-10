import { SYSTEM_REASON } from "@banijjik/contracts";
import { runAsSystem } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildEnsureSeedPackagesUseCase } from "../modules/platform/package/index.js";

export interface SeedPackagesOutcome {
  readonly createdCount: number;
}

/**
 * Inserts the seed packages that are missing (10-MODULE-CATALOG section 9) and never touches an
 * existing one. Needs connected databases and registered models. Safe to run again. The system
 * access mark lives here, outside the modules (R26).
 */
export async function seedPackages(clock: Clock): Promise<SeedPackagesOutcome> {
  const useCase = buildEnsureSeedPackagesUseCase(clock);
  return runAsSystem(SYSTEM_REASON.SEED, () => useCase.execute());
}
