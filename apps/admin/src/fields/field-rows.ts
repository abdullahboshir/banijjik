import {
  CUSTOM_FIELD_SCOPE,
  type ContactRole,
  type CustomFieldEntityType,
  type CustomFieldScope,
  type CustomFieldType,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";

/** What the person may do with fields, from the key permissions held at every location and the access mode. */
export interface FieldAbilities {
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
}

/** One effective field as the list and its sheets need it; plain data, so it can cross to the client. */
export interface FieldRowView {
  entityType: CustomFieldEntityType;
  fieldKey: string;
  scope: CustomFieldScope;
  label: string;
  labelBn: string;
  labelEn: string;
  fieldType: CustomFieldType;
  typeLabel: string;
  isRequired: boolean;
  isSensitive: boolean;
  isSearchable: boolean;
  botAsk: boolean;
  options: string[];
  /** Contact fields only. Empty means every role. */
  appliesToContactRoles: ContactRole[];
  sortOrder: number;
  /** The definition's version, or the preference row's (0 when the business has none yet). */
  version: number;
  customFieldDefinitionId: string | undefined;
  /** The business's own field: edit and archive. */
  canEdit: boolean;
  canArchive: boolean;
  /** A template field: rename and reorder. */
  canCustomize: boolean;
  /** A template field that is not required: hide. */
  canHide: boolean;
  /** A template field the business hid: it is listed greyed so it can be shown again. */
  isHidden: boolean;
  canShow: boolean;
}

function labelFor(field: EffectiveCustomField, locale: Locale): string {
  const text = field.label[locale].trim();
  if (text.length > 0) return text;
  return (locale === "bn" ? field.label.en : field.label.bn).trim();
}

/** What turns an effective field into a row: what the person may do, and their language. */
export interface FieldRowContext {
  abilities: FieldAbilities;
  locale: Locale;
  t: Translator["t"];
}

/** The choices and contact roles of a field as plain lists; empty roles mean every role. */
function optionsAndRolesOf(
  field: EffectiveCustomField,
): Pick<FieldRowView, "options" | "appliesToContactRoles"> {
  return {
    options: [...(field.options ?? [])],
    appliesToContactRoles: [...(field.appliesToContactRoles ?? [])],
  };
}

function toRow(field: EffectiveCustomField, context: FieldRowContext): FieldRowView {
  const { abilities, locale, t } = context;
  const isOwn = field.scope === CUSTOM_FIELD_SCOPE.ORGANIZATION;
  const isHidden = field.isHidden === true;
  return {
    entityType: field.entityType,
    fieldKey: field.fieldKey,
    scope: field.scope,
    label: labelFor(field, locale),
    labelBn: field.label.bn,
    labelEn: field.label.en,
    fieldType: field.fieldType,
    typeLabel: t(`fields.type.${field.fieldType}`),
    isRequired: field.isRequired,
    isSensitive: field.isSensitive,
    isSearchable: field.isSearchable,
    botAsk: field.botAsk,
    ...optionsAndRolesOf(field),
    sortOrder: field.sortOrder,
    version: field.version,
    customFieldDefinitionId: field.customFieldDefinitionId,
    canEdit: isOwn && abilities.canUpdate,
    canArchive: isOwn && abilities.canArchive,
    canCustomize: !isOwn && !isHidden && abilities.canUpdate,
    canHide: !isOwn && !isHidden && abilities.canUpdate && !field.isRequired,
    isHidden,
    canShow: isHidden && abilities.canUpdate,
  };
}

export function toFieldRows(
  fields: readonly EffectiveCustomField[],
  context: FieldRowContext,
): FieldRowView[] {
  return fields.map((field) => toRow(field, context));
}

/** The next sort order for a new field: after the last one, in steps of ten. */
export function nextSortOrder(fields: readonly EffectiveCustomField[]): number {
  const SORT_ORDER_STEP = 10;
  return fields.reduce((highest, field) => Math.max(highest, field.sortOrder), 0) + SORT_ORDER_STEP;
}
