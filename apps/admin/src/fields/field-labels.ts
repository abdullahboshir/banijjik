import { CONTACT_ROLE, type ContactRole, type CustomFieldType } from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import { termLabel, type TermTexts } from "@banijjik/web-client";

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
    appliesToRoles: string;
    allRoles: string;
  };
  /**
   * The roles the template allows, each named by the business's term `contact.<ROLE>` when it has
   * one (ADR-113). A contact field can be limited to these.
   */
  roles: { role: ContactRole; label: string }[];
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

/** The terms and language that name the contact roles; without them the catalog names are used. */
export interface RoleTextSource {
  terms: TermTexts;
  locale: Locale;
  /** The template's `contactRoleKeys` from `/me/config`. */
  roleKeys: readonly ContactRole[];
}

function roleLabelsOf(
  t: Translator["t"],
  source?: RoleTextSource,
): { role: ContactRole; label: string }[] {
  const roles = source?.roleKeys ?? Object.values(CONTACT_ROLE);
  return roles.map((role) => {
    const fallback = t(`contactRole.${role}`);
    const label =
      source === undefined
        ? fallback
        : termLabel(source.terms, `contact.${role}`, { locale: source.locale, fallback });
    return { role, label };
  });
}

export function fieldLabelsOf(t: Translator["t"], roleTexts?: RoleTextSource): FieldLabels {
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
      appliesToRoles: t("fields.form.appliesToRoles"),
      allRoles: t("fields.form.allRoles"),
    },
    roles: roleLabelsOf(t, roleTexts),
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
