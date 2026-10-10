import type { LimitMap } from "@banijjik/contracts";
import type { LimitIncrements } from "../domain/package.entity.js";

/** One package of the seed data. The seed use case turns each into a `Package` when it is missing. */
export interface SeedPackage {
  readonly packageKey: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly string[];
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
}
