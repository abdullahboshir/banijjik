import type { ModuleManifest } from "@banijjik/contracts";
import { deepFreeze } from "./deep-freeze.js";
import { assertManifestShape } from "./manifest-schema.js";

/**
 * The only way a module declares itself (10-MODULE-CATALOG section 2). It checks the shape of the
 * manifest and returns a frozen copy. Rules that involve other manifests (unique keys, dependency
 * cycles, route owners) are checked when the registry is built.
 */
export function defineModule(manifest: ModuleManifest): ModuleManifest {
  assertManifestShape(manifest);
  // A structured clone keeps the caller's object untouched and makes the freeze deep and safe.
  return deepFreeze(structuredClone(manifest));
}
