import type { Translator } from "@banijjik/i18n";

export interface ModuleListLabels {
  module: string;
  moduleClass: string;
  status: string;
  actions: string;
  turnOff: string;
  turnOn: string;
  neededBy: string;
  empty: string;
}

export interface ModuleSheetLabels {
  turnOffTitle: string;
  turnOnTitle: string;
  turnOff: string;
  turnOn: string;
  reason: string;
  reasonHint: string;
  close: string;
  conflict: string;
  reload: string;
}

export function moduleListLabelsOf(t: Translator["t"]): ModuleListLabels {
  return {
    module: t("modules.column.module"),
    moduleClass: t("modules.column.class"),
    status: t("modules.column.status"),
    actions: t("modules.column.actions"),
    turnOff: t("modules.turnOff"),
    turnOn: t("modules.turnOn"),
    neededBy: t("modules.neededBy"),
    empty: t("modules.empty"),
  };
}

export function moduleSheetLabelsOf(t: Translator["t"]): ModuleSheetLabels {
  return {
    turnOffTitle: t("modules.turnOff.title"),
    turnOnTitle: t("modules.turnOn.title"),
    turnOff: t("modules.turnOff"),
    turnOn: t("modules.turnOn"),
    reason: t("modules.reason"),
    reasonHint: t("modules.reason.hint"),
    close: t("shell.closeMenu"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
  };
}
