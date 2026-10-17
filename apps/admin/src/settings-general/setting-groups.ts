import type { Translator } from "@banijjik/i18n";
import type { SettingRowView } from "./setting-rows";

export interface SettingGroupView {
  /** The module part of the setting keys, such as `organization` in `organization.digitScript`. */
  groupKey: string;
  rows: SettingRowView[];
}

export interface SettingGroupTexts {
  title: string;
  help: string;
}

const OTHER_GROUP_KEY = "other";

/** Rows grouped by the module part of their key, groups in order of first appearance (the response's key order). */
export function groupSettingRows(rows: readonly SettingRowView[]): SettingGroupView[] {
  const groups = new Map<string, SettingRowView[]>();
  for (const row of rows) {
    const groupKey = row.settingKey.split(".")[0] ?? OTHER_GROUP_KEY;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return [...groups].map(([groupKey, groupRows]) => ({ groupKey, rows: groupRows }));
}

/** A module that adds settings gets its own title and help line from two message keys; until then the generic text is shown. */
export function settingGroupTexts(groupKey: string, t: Translator["t"]): SettingGroupTexts {
  const titleKey = `settings.general.group.${groupKey}`;
  const hasOwnTexts = t(titleKey) !== titleKey;
  const key = hasOwnTexts ? titleKey : `settings.general.group.${OTHER_GROUP_KEY}`;
  return { title: t(key), help: t(`${key}.help`) };
}
