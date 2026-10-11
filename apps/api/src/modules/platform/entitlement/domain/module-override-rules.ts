import { MODULE_CLASS, type ModuleKey, type ModuleManifest } from "@banijjik/contracts";
import { moduleClassFixed, moduleNotRegistered } from "./override-errors.js";

/**
 * A platform grant or revoke is for CORE and OPTIONAL modules that exist in this release.
 * SYSTEM modules are always on and PLATFORM modules never reach an organization, so neither
 * can be granted or revoked.
 */
export function assertOverridable(
  moduleKey: ModuleKey,
  manifests: readonly ModuleManifest[],
): void {
  const manifest = manifests.find((candidate) => candidate.key === moduleKey);
  if (manifest === undefined) throw moduleNotRegistered();
  const isFixed =
    manifest.moduleClass === MODULE_CLASS.SYSTEM || manifest.moduleClass === MODULE_CLASS.PLATFORM;
  if (isFixed) throw moduleClassFixed();
}
