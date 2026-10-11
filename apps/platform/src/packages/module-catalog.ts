import {
  MODULE_CLASS,
  MODULE_CLASS_BY_KEY,
  MODULE_KEY_VALUES,
  type ModuleClass,
  type ModuleKey,
} from "@banijjik/contracts";

/**
 * The classes a package can hold: CORE and OPTIONAL. SYSTEM modules are always on and PLATFORM modules never
 * reach an organization (10-MODULE-CATALOG section 1).
 */
export const PACKAGE_MODULE_CLASSES: readonly ModuleClass[] = [
  MODULE_CLASS.CORE,
  MODULE_CLASS.OPTIONAL,
];

export function moduleLabelKey(moduleKey: string): string {
  return `platform.module.${moduleKey}`;
}

export function moduleClassLabelKey(moduleClass: ModuleClass): string {
  return `platform.moduleClass.${moduleClass}`;
}

/** Every module key, in catalogue order, with its label key. Client forms receive the translated labels as props. */
export const MODULE_LABEL_KEYS: readonly string[] = MODULE_KEY_VALUES.map(moduleLabelKey);

export function modulesOfClass(moduleClass: ModuleClass): ModuleKey[] {
  return MODULE_KEY_VALUES.filter((moduleKey) => MODULE_CLASS_BY_KEY[moduleKey] === moduleClass);
}

/**
 * The modules an operator can grant or revoke for one tenant. CORE modules are always part of a tenant's
 * configuration, so a grant or revoke could change nothing there; SYSTEM and PLATFORM are refused by the API.
 */
export function grantableModules(): ModuleKey[] {
  return modulesOfClass(MODULE_CLASS.OPTIONAL);
}
