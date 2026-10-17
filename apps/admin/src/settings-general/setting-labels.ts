import type { SettingValueSource } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

export interface SettingSheetLabels {
  close: string;
  save: string;
  reset: string;
  conflict: string;
  reload: string;
  valueField: string;
  readOnly: string;
}

export interface SettingListLabels {
  setting: string;
  value: string;
  source: string;
  actions: string;
  change: string;
  empty: string;
}

export function settingSheetLabelsOf(t: Translator["t"]): SettingSheetLabels {
  return {
    close: t("shell.closeMenu"),
    save: t("common.save"),
    reset: t("settings.general.reset"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    valueField: t("settings.general.value"),
    readOnly: t("settings.general.readOnly"),
  };
}

export function settingListLabelsOf(t: Translator["t"]): SettingListLabels {
  return {
    setting: t("settings.general.column.setting"),
    value: t("settings.general.column.value"),
    source: t("settings.general.column.source"),
    actions: t("settings.general.column.actions"),
    change: t("settings.general.change"),
    empty: t("settings.general.empty"),
  };
}

export function sourceLabelOf(source: SettingValueSource, t: Translator["t"]): string {
  return t(`settings.source.${source}`);
}
