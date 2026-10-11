import type { PermissionDefinitionResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

/** One permission as the role screens show it. */
export interface PermissionItem {
  permissionKey: string;
  label: string;
  isSensitive: boolean;
  /** The caller holds it at every location, so the caller may hand it to a role. */
  isHeld: boolean;
  isSelected: boolean;
}

/** The permissions of one module: the ordinary ones, then the sensitive ones in their own block (10 section 7). */
export interface PermissionGroup {
  moduleKey: string;
  label: string;
  regular: PermissionItem[];
  sensitive: PermissionItem[];
}

export interface PermissionGroupInput {
  definitions: readonly PermissionDefinitionResponse[];
  /** Keys the caller holds at every location. */
  heldKeys: ReadonlySet<string>;
  /** Keys the role has now (an empty set for a new role). */
  selectedKeys: ReadonlySet<string>;
  /**
   * The form offers only what the caller holds (or what the role already has, shown locked);
   * the detail page lists only what the role has.
   */
  mode: "offer" | "show";
  t: Translator["t"];
  hasText: Translator["has"];
}

function groupLabelOf(moduleKey: string, input: PermissionGroupInput): string {
  const key = `roles.module.${moduleKey}`;
  return input.hasText(key) ? input.t(key) : moduleKey;
}

function isListed(item: PermissionItem, mode: PermissionGroupInput["mode"]): boolean {
  if (mode === "show") return item.isSelected;
  return item.isHeld || item.isSelected;
}

/**
 * Groups permissions by module (the first segment of the key), in the order the manifests declared
 * them. Which ones are sensitive comes from the definitions the API sent, never from a list in the app.
 */
export function groupPermissions(input: PermissionGroupInput): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();
  for (const definition of input.definitions) {
    const item: PermissionItem = {
      permissionKey: definition.permissionKey,
      label: input.t(definition.labelKey),
      isSensitive: definition.isSensitive,
      isHeld: input.heldKeys.has(definition.permissionKey),
      isSelected: input.selectedKeys.has(definition.permissionKey),
    };
    if (!isListed(item, input.mode)) continue;
    const group = groups.get(definition.moduleKey) ?? {
      moduleKey: definition.moduleKey,
      label: groupLabelOf(definition.moduleKey, input),
      regular: [],
      sensitive: [],
    };
    (item.isSensitive ? group.sensitive : group.regular).push(item);
    groups.set(definition.moduleKey, group);
  }
  return [...groups.values()];
}
