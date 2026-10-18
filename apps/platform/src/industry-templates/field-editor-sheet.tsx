"use client";

import {
  CUSTOM_FIELD_TYPE,
  type ContactRole,
  type IndustryTemplateCustomField,
} from "@banijjik/contracts";
import { FieldFlagFields, FieldIdentityFields, OptionFields } from "./field-editor-parts";
import { ReferenceFields } from "./field-reference-fields";
import { RoleFields } from "./field-role-fields";
import { useState, type ReactElement } from "react";
import { FormSheet } from "../forms/form-sheet";
import { customFieldIsValid } from "./custom-field-is-valid";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";

const SELECT_TYPES: readonly string[] = [CUSTOM_FIELD_TYPE.SELECT, CUSTOM_FIELD_TYPE.MULTI_SELECT];

export interface FieldEditorSheetProps {
  field: IndustryTemplateCustomField;
  isExisting: boolean;
  isTypeLocked: boolean;
  /** The roles the template lists: a contact field can be limited to these. */
  contactRoleKeys: readonly ContactRole[];
  labels: IndustryLabels;
  onApply: (field: IndustryTemplateCustomField) => void;
  onClose: () => void;
}

/** The custom-field editor. It checks the field with the API's configuration schema before applying it. */
export function FieldEditorSheet(props: FieldEditorSheetProps): ReactElement {
  const t = labelsTranslator(props.labels);
  const [draft, setDraft] = useState(props.field);
  const [invalid, setInvalid] = useState(false);
  const isSelect = SELECT_TYPES.includes(draft.fieldType);
  const isReference = draft.fieldType === CUSTOM_FIELD_TYPE.REFERENCE;

  function apply(): void {
    const next = normalizedField(draft);
    setInvalid(!customFieldIsValid(next));
    if (!customFieldIsValid(next)) return;
    props.onApply(next);
    props.onClose();
  }

  return (
    <FormSheet
      title={t("platform.industry.action.addField")}
      submitLabel={t("platform.industry.action.save")}
      isSubmitting={false}
      failure={
        invalid ? { messageKey: "validation.invalid_value", gaps: [], removed: [] } : undefined
      }
      onSubmit={apply}
      onClose={props.onClose}
    >
      <FieldIdentityFields
        draft={draft}
        isExisting={props.isExisting}
        isTypeLocked={props.isTypeLocked}
        labels={props.labels}
        onChange={setDraft}
      />
      <FieldFlagFields draft={draft} labels={props.labels} onChange={setDraft} />
      {isSelect ? <OptionFields draft={draft} labels={props.labels} onChange={setDraft} /> : null}
      {draft.entityType === "contact" ? (
        <RoleFields
          draft={draft}
          contactRoleKeys={props.contactRoleKeys}
          labels={props.labels}
          onChange={setDraft}
        />
      ) : null}
      {isReference ? (
        <ReferenceFields draft={draft} labels={props.labels} onChange={setDraft} />
      ) : null}
    </FormSheet>
  );
}

function normalizedField(draft: IndustryTemplateCustomField): IndustryTemplateCustomField {
  const isSelect = SELECT_TYPES.includes(draft.fieldType);
  const isReference = draft.fieldType === CUSTOM_FIELD_TYPE.REFERENCE;
  const offeringKind = draft.entityType === "offering" ? draft.offeringKind : undefined;
  return {
    entityType: draft.entityType,
    ...(offeringKind === undefined ? {} : { offeringKind }),
    fieldKey: draft.fieldKey.trim(),
    fieldType: draft.fieldType,
    isRequired: draft.isRequired,
    botAsk: draft.botAsk,
    visibility: draft.visibility,
    isSearchable: draft.isSearchable,
    isSensitive: draft.isSensitive,
    label: draft.label,
    ...rolesOf(draft),
    ...(isSelect ? { options: draft.options ?? [], optionLabels: draft.optionLabels } : {}),
    ...(isReference && draft.referenceEntity !== undefined
      ? { referenceEntity: draft.referenceEntity }
      : {}),
    ...(isReference && draft.referenceEntity === "contact" && draft.link !== undefined
      ? { link: draft.link }
      : {}),
  };
}

/** Roles belong to contact fields only; a field without any keeps no property (every role). */
function rolesOf(
  draft: IndustryTemplateCustomField,
): Pick<IndustryTemplateCustomField, "appliesToContactRoles"> {
  if (draft.entityType !== "contact") return {};
  return draft.appliesToContactRoles === undefined
    ? {}
    : { appliesToContactRoles: draft.appliesToContactRoles };
}
