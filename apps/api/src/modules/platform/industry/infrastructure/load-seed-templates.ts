import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  industryTemplateSeedSchema,
  toIndustryTemplateConfiguration,
  type IndustryTemplateSeed,
} from "@banijjik/validation";
import type { NewIndustryTemplateInput } from "../domain/industry-template.entity.js";

// tsc does not emit JSON, so the api build copies this folder into dist.
const SEED_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "seeds");

const SEED_FILE_NAMES = [
  "fcommerce.json",
  "retail.json",
  "salon.json",
  "clinic.json",
  "gym.json",
  "coaching.json",
  "restaurant.json",
  "hostel.json",
] as const;

export type SeedIndustryTemplateInput = Omit<NewIndustryTemplateInput, "now">;

function toSeedInput(seed: IndustryTemplateSeed): SeedIndustryTemplateInput {
  return {
    industryTemplateKey: seed.industryTemplateKey,
    status: seed.status,
    name: seed.name,
    description: seed.description,
    iconKey: seed.iconKey,
    enabledKinds: seed.enabledKinds,
    allowedModuleKeys: seed.allowedModuleKeys,
    configuration: toIndustryTemplateConfiguration(seed.configuration),
  };
}

/** The eight seed files, checked by the configuration schema. The factory checks them again on insert. */
export function loadSeedIndustryTemplates(): readonly SeedIndustryTemplateInput[] {
  return SEED_FILE_NAMES.map((fileName) => {
    const raw: unknown = JSON.parse(readFileSync(join(SEED_DIRECTORY, fileName), "utf8"));
    return toSeedInput(industryTemplateSeedSchema.parse(raw));
  });
}
