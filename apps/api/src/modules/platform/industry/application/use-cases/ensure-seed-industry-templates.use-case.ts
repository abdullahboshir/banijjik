import type { Clock } from "../../../../../kernel/time/index.js";
import { IndustryTemplate } from "../../domain/industry-template.entity.js";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";
import type { NewIndustryTemplateInput } from "../../domain/industry-template.entity.js";

export interface EnsureSeedIndustryTemplatesDependencies {
  readonly templates: IndustryTemplateRepository;
  readonly seed: readonly Omit<NewIndustryTemplateInput, "now">[];
  readonly clock: Clock;
}

export interface EnsureSeedIndustryTemplatesResult {
  readonly createdCount: number;
}

/**
 * Inserts the seed templates whose key is missing and never overwrites an existing one.
 * After the first seed the database is the source of truth (ADR-076), so a later edit survives
 * a restart.
 */
export class EnsureSeedIndustryTemplatesUseCase {
  constructor(private readonly dependencies: EnsureSeedIndustryTemplatesDependencies) {}

  async execute(): Promise<EnsureSeedIndustryTemplatesResult> {
    const { templates, seed, clock } = this.dependencies;
    const existing = await templates.findExistingKeys(
      seed.map((entry) => entry.industryTemplateKey),
    );
    const missing = seed.filter((entry) => !existing.has(entry.industryTemplateKey));
    const now = clock.now();
    for (const entry of missing) {
      await templates.insert(IndustryTemplate.create({ ...entry, now }));
    }
    return { createdCount: missing.length };
  }
}
