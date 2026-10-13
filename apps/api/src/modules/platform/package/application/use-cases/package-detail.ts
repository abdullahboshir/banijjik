import { type ModuleKey } from "@banijjik/contracts";
import { Package } from "../../domain/package.entity.js";

/** A package with the module keys that have no manifest yet, so the panel can show what is not built. */
export interface PackageDetail {
  readonly package: Package;
  readonly unbuiltModuleKeys: readonly ModuleKey[];
}
