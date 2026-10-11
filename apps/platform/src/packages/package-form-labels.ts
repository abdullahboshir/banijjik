import {
  LIMIT_KEY_VALUES,
  MODULE_CLASS,
  MODULE_KEY_VALUES,
  type LimitKey,
  type ModuleClass,
  type ModuleKey,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { pickLabels, type Labels } from "../lib/labels";
import { moduleClassLabelKey, moduleLabelKey } from "./module-catalog";

export const PACKAGE_FORM_LABEL_KEYS = [
  "platform.package.field.packageKey",
  "platform.package.field.packageKeyHint",
  "platform.package.field.name",
  "platform.package.field.nameSeedHint",
  "platform.package.field.kind",
  "platform.package.kind.base",
  "platform.package.kind.addOn",
  "platform.package.modules",
  "platform.package.limits",
  "platform.package.limitsHint",
  "platform.package.unlimited",
  "platform.package.increments",
  "platform.package.incrementsHint",
  "platform.package.notBuilt",
  "platform.package.gapsTitle",
  "platform.package.gap",
  "platform.package.create",
  "platform.package.save",
  "platform.package.created",
  "platform.package.saved",
  "platform.package.readOnly",
  "platform.package.archive",
  "platform.package.archiveTitle",
  "platform.package.archiveDescription",
  "platform.package.archived",
] as const;

export type PackageFormLabels = Labels<(typeof PACKAGE_FORM_LABEL_KEYS)[number]>;

/** All the text of the package form, translated on the server: fixed labels, module names, limit names. */
export interface PackageFormTexts {
  labels: PackageFormLabels;
  moduleLabels: Record<ModuleKey, string>;
  limitLabels: Record<LimitKey, string>;
  classLabels: Record<ModuleClass, string>;
}

function labelMap<Key extends string>(
  keys: readonly Key[],
  labelOf: (key: Key) => string,
): Record<Key, string> {
  // Safe: built from the full list of keys, so every key is present.
  return Object.fromEntries(keys.map((key) => [key, labelOf(key)])) as Record<Key, string>;
}

export function packageFormTexts(t: Translator["t"]): PackageFormTexts {
  return {
    labels: pickLabels(t, PACKAGE_FORM_LABEL_KEYS),
    moduleLabels: labelMap(MODULE_KEY_VALUES, (key) => t(moduleLabelKey(key))),
    limitLabels: labelMap(LIMIT_KEY_VALUES, (key) => t(`platform.limit.${key}`)),
    classLabels: labelMap(Object.values(MODULE_CLASS), (key) => t(moduleClassLabelKey(key))),
  };
}
