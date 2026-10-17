import type { CustomFieldType } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";

/** All text of the field screens, translated on the server; the client sheets get it as props. */
export interface FieldLabels {
  close: string;
  save: string;
  cancel: string;
  conflict: string;
  reload: string;
  createTitle: string;
  editTitle: string;
  customizeTitle: string;
  hideTitle: string;
  hideDescription: string;
  showTitle: string;
  showDescription: string;
  archiveTitle: string;
  archiveDescription: string;
  formFields: {
    fieldKey: string;
    fieldKeyHint: string;
    labelBn: string;
    labelEn: string;
    fieldType: string;
    options: string;
    optionsHint: string;
    isRequired: string;
    isSensitive: string;
    isSearchable: string;
    botAsk: string;
    sortOrder: string;
  };
  lockedHint: string;
  types: Record<CustomFieldType, string>;
}

export interface FieldListLabels {
  field: string;
  key: string;
  type: string;
  traits: string;
  actions: string;
  edit: string;
  customize: string;
  hide: string;
  show: string;
  archive: string;
  empty: string;
  hidden: string;
  scopeIndustry: string;
  scopeOrganization: string;
  required: string;
  sensitive: string;
  botAsk: string;
}

export function fieldTypeLabelsOf(t: Translator["t"]): Record<CustomFieldType, string> {
  const labels = {} as Record<CustomFieldType, string>;
  for (const fieldType of FIELD_TYPES) labels[fieldType] = t(`fields.type.${fieldType}`);
  return labels;
}

/** Every type the API knows; the form offers only the ones a person can fill in today. */
const FIELD_TYPES: readonly CustomFieldType[] = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DECIMAL",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "SELECT",
  "MULTI_SELECT",
  "PHONE",
  "EMAIL",
  "URL",
  "CURRENCY",
  "FILE",
  "IMAGE",
  "REFERENCE",
];

export function fieldLabelsOf(t: Translator["t"]): FieldLabels {
  return {
    close: t("shell.closeMenu"),
    save: t("common.save"),
    cancel: t("common.cancel"),
    conflict: t("settings.conflict"),
    reload: t("settings.reload"),
    createTitle: t("fields.form.create.title"),
    editTitle: t("fields.form.edit.title"),
    customizeTitle: t("fields.form.customize.title"),
    hideTitle: t("fields.hide.title"),
    hideDescription: t("fields.hide.description"),
    showTitle: t("fields.show.title"),
    showDescription: t("fields.show.description"),
    archiveTitle: t("fields.archive.title"),
    archiveDescription: t("fields.archive.description"),
    formFields: {
      fieldKey: t("fields.form.key"),
      fieldKeyHint: t("fields.form.key.hint"),
      labelBn: t("fields.form.labelBn"),
      labelEn: t("fields.form.labelEn"),
      fieldType: t("fields.form.type"),
      options: t("fields.form.options"),
      optionsHint: t("fields.form.options.hint"),
      isRequired: t("fields.form.required"),
      isSensitive: t("fields.form.sensitive"),
      isSearchable: t("fields.form.searchable"),
      botAsk: t("fields.form.botAsk"),
      sortOrder: t("fields.form.sortOrder"),
    },
    lockedHint: t("fields.form.locked"),
    types: fieldTypeLabelsOf(t),
  };
}

export function fieldListLabelsOf(t: Translator["t"]): FieldListLabels {
  return {
    field: t("fields.column.field"),
    key: t("fields.column.key"),
    type: t("fields.column.type"),
    traits: t("fields.column.traits"),
    actions: t("fields.column.actions"),
    edit: t("fields.edit"),
    customize: t("fields.customize"),
    hide: t("fields.hide"),
    show: t("fields.show"),
    hidden: t("fields.trait.hidden"),
    archive: t("fields.archive"),
    empty: t("fields.empty"),
    scopeIndustry: t("fields.scope.INDUSTRY"),
    scopeOrganization: t("fields.scope.ORGANIZATION"),
    required: t("fields.trait.required"),
    sensitive: t("fields.trait.sensitive"),
    botAsk: t("fields.trait.botAsk"),
  };
}
