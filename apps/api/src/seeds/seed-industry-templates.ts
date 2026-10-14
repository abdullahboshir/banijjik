import { SYSTEM_REASON } from "@banijjik/contracts";
import { runAsSystem } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildEnsureSeedIndustryTemplatesUseCase } from "../modules/platform/industry/index.js";

export interface SeedIndustryTemplatesOutcome {
  readonly createdCount: number;
}

/**
 * Inserts the seed industry templates that are missing (12-INDUSTRY-TEMPLATES) and never touches
 * an existing one. Needs connected databases and registered models. Safe to run again. The system
 * access mark lives here, outside the modules (R26).
 */
export async function seedIndustryTemplates(clock: Clock): Promise<SeedIndustryTemplatesOutcome> {
  const useCase = buildEnsureSeedIndustryTemplatesUseCase(clock);
  return runAsSystem(SYSTEM_REASON.SEED, () => useCase.execute());
}
