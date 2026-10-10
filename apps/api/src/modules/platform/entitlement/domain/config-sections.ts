import {
  MENU_VISIBILITY,
  type MenuEntry,
  type ModuleKey,
  type ModuleManifest,
  type OfferingKind,
} from "@banijjik/contracts";

const MINIMUM_LOCATIONS_FOR_MULTIPLE = 2;

function manifestsOf(
  manifests: readonly ModuleManifest[],
  moduleKeys: ReadonlySet<ModuleKey>,
): readonly ModuleManifest[] {
  return manifests.filter((manifest) => moduleKeys.has(manifest.key));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function byOrderThenKey(left: MenuEntry, right: MenuEntry): number {
  return left.order - right.order || left.menuKey.localeCompare(right.menuKey, "en");
}

/** Menu entries of the effective modules, hiding the ones that need a kind the organization lacks. */
export function menuOf(
  manifests: readonly ModuleManifest[],
  moduleKeys: ReadonlySet<ModuleKey>,
  kinds: readonly OfferingKind[],
): readonly MenuEntry[] {
  return manifestsOf(manifests, moduleKeys)
    .flatMap((manifest) => manifest.menu)
    .filter((entry) => entry.requiresKind === undefined || kinds.includes(entry.requiresKind))
    .sort(byOrderThenKey);
}

export function botToolsOf(
  manifests: readonly ModuleManifest[],
  moduleKeys: ReadonlySet<ModuleKey>,
): readonly string[] {
  return unique(manifestsOf(manifests, moduleKeys).flatMap((manifest) => manifest.botTools));
}

export function storefrontSectionsOf(
  manifests: readonly ModuleManifest[],
  moduleKeys: ReadonlySet<ModuleKey>,
): readonly string[] {
  return unique(
    manifestsOf(manifests, moduleKeys).flatMap((manifest) => manifest.storefrontSections),
  );
}

/** Drops the entries that need two or more active locations while the organization has fewer. */
export function applyMenuVisibility(
  menu: readonly MenuEntry[],
  activeLocationCount: number,
): readonly MenuEntry[] {
  if (activeLocationCount >= MINIMUM_LOCATIONS_FOR_MULTIPLE) return menu;
  return menu.filter((entry) => entry.visibility !== MENU_VISIBILITY.MULTIPLE_ACTIVE_LOCATIONS);
}

export function needsLocationCount(menu: readonly MenuEntry[]): boolean {
  return menu.some((entry) => entry.visibility === MENU_VISIBILITY.MULTIPLE_ACTIVE_LOCATIONS);
}
