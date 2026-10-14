import {
  INDUSTRY_TEMPLATE_STATUS,
  MODULE_CLASS,
  MODULE_CLASS_BY_KEY,
  OFFERING_KIND,
  isIndustryTemplateKey,
  isModuleKey,
  type IndustryTemplateKey,
  type IndustryTemplateStatus,
  type LocalizedText,
  type ModuleKey,
  type OfferingKind,
} from "@banijjik/contracts";
import { invalidIndustryTemplateField } from "./errors.js";

export const INDUSTRY_TEMPLATE_NAME_MAX_LENGTH = 80;
export const INDUSTRY_TEMPLATE_DESCRIPTION_MAX_LENGTH = 160;
const ICON_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const STATUS_VALUES = [
  INDUSTRY_TEMPLATE_STATUS.DRAFT,
  INDUSTRY_TEMPLATE_STATUS.PUBLISHED,
  INDUSTRY_TEMPLATE_STATUS.RETIRED,
] as const;

function isStatus(value: string): value is IndustryTemplateStatus {
  for (const status of STATUS_VALUES) {
    if (status === value) return true;
  }
  return false;
}

function assertText(value: string, path: string, maxLength: number): string {
  const text = value.trim();
  if (text.length < 1 || text.length > maxLength) throw invalidIndustryTemplateField(path);
  return text;
}

export function assertLocalized(
  value: LocalizedText,
  path: string,
  maxLength: number,
): LocalizedText {
  return {
    bn: assertText(value.bn, `${path}.bn`, maxLength),
    en: assertText(value.en, `${path}.en`, maxLength),
  };
}

const OFFERING_KIND_VALUES: readonly string[] = Object.values(OFFERING_KIND);

export function assertTemplateKey(value: string): IndustryTemplateKey {
  if (!isIndustryTemplateKey(value)) throw invalidIndustryTemplateField("industryTemplateKey");
  return value;
}

export function assertStatus(value: string): IndustryTemplateStatus {
  if (!isStatus(value)) throw invalidIndustryTemplateField("status");
  return value;
}

export function assertIconKey(value: string): string {
  if (!ICON_KEY_PATTERN.test(value)) throw invalidIndustryTemplateField("iconKey");
  return value;
}

export function assertEnabledKinds(values: readonly string[]): readonly OfferingKind[] {
  const known = values.filter((kind): kind is OfferingKind => OFFERING_KIND_VALUES.includes(kind));
  if (known.length !== values.length || known.length === 0) {
    throw invalidIndustryTemplateField("enabledKinds");
  }
  if (new Set(known).size !== known.length) throw invalidIndustryTemplateField("enabledKinds");
  return known;
}

/** CORE and OPTIONAL only. SYSTEM modules are always on and are not listed (12 section 1). */
export function assertAllowedModuleKeys(values: readonly string[]): readonly ModuleKey[] {
  const accepted: ModuleKey[] = [];
  for (const key of values) {
    if (!isModuleKey(key)) throw invalidIndustryTemplateField("allowedModuleKeys");
    const moduleClass = MODULE_CLASS_BY_KEY[key];
    const isSellable = moduleClass === MODULE_CLASS.CORE || moduleClass === MODULE_CLASS.OPTIONAL;
    if (!isSellable) throw invalidIndustryTemplateField("allowedModuleKeys");
    accepted.push(key);
  }
  if (accepted.length === 0 || new Set(accepted).size !== accepted.length) {
    throw invalidIndustryTemplateField("allowedModuleKeys");
  }
  return accepted;
}
