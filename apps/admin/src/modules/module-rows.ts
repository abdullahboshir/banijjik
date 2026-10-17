import type { ModuleKey, TenantModuleView } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

export type ModuleStatus = "ON" | "OFF_BY_YOU" | "NOT_IN_PACKAGE";
export type ModuleSwitchAction = "disable" | "enable";

/** One module of the business's catalogue; plain data, so it can cross to the client. */
export interface ModuleRowView {
  moduleKey: ModuleKey;
  label: string;
  classLabel: string;
  status: ModuleStatus;
  statusLabel: string;
  /** Names of the modules that need this one; the module cannot be turned off while there are any. */
  neededBy: string[];
  /** The switch the person may press now; absent when the module cannot be switched here. */
  action: ModuleSwitchAction | undefined;
  /** The module could be turned off, but others need it. */
  isLockedByDependents: boolean;
}

function statusOf(module: TenantModuleView): ModuleStatus {
  if (module.isDisabledByTenant) return "OFF_BY_YOU";
  return module.isEffective ? "ON" : "NOT_IN_PACKAGE";
}

function actionOf(module: TenantModuleView, canEdit: boolean): ModuleSwitchAction | undefined {
  if (!canEdit || !module.tenantCanDisable) return undefined;
  if (module.isDisabledByTenant) return "enable";
  return module.isEffective ? "disable" : undefined;
}

/** The module name is `module.<key>`; a module the catalog does not name yet shows as its key. */
export function moduleNameOf(moduleKey: ModuleKey, t: Translator["t"]): string {
  const labelKey = `module.${moduleKey}`;
  return t(labelKey) === labelKey ? moduleKey : t(labelKey);
}

export function toModuleRows(
  modules: readonly TenantModuleView[],
  canEdit: boolean,
  t: Translator["t"],
): ModuleRowView[] {
  return modules.map((module) => {
    const status = statusOf(module);
    const action = actionOf(module, canEdit);
    return {
      moduleKey: module.moduleKey,
      label: moduleNameOf(module.moduleKey, t),
      classLabel: t(`modules.class.${module.moduleClass}`),
      status,
      statusLabel: t(`modules.status.${status}`),
      neededBy: module.requiredBy.map((moduleKey) => moduleNameOf(moduleKey, t)),
      action,
      isLockedByDependents: action === "disable" && module.requiredBy.length > 0,
    };
  });
}
