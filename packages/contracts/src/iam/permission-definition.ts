import { permissionLabelKey, type PermissionKey } from "./permission-key.js";
import { SURFACE, type Surface } from "./surface.js";

/** One permission as a module manifest declares it (10-MODULE-CATALOG section 2). */
export interface PermissionDefinition {
  readonly permissionKey: PermissionKey;
  readonly labelKey: string;
  /** Shown separately in the role editor (the `*` keys of section 7). */
  readonly isSensitive: boolean;
  readonly surface: Surface;
}

export interface PermissionDefinitionOptions {
  readonly isSensitive?: boolean;
  readonly surface?: Surface;
}

/** Builds a manifest entry; the label key is always `permission.<key>`. */
export function permissionDefinition(
  permissionKey: PermissionKey,
  options: PermissionDefinitionOptions = {},
): PermissionDefinition {
  return {
    permissionKey,
    labelKey: permissionLabelKey(permissionKey),
    isSensitive: options.isSensitive ?? false,
    surface: options.surface ?? SURFACE.ADMIN,
  };
}
