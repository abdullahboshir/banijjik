"use client";

import {
  CUSTOM_FIELD_ENTITY_TYPE,
  CUSTOM_FIELD_TYPE,
  OFFERING_KIND,
  type IndustryTemplateCustomField,
} from "@banijjik/contracts";
import { Checkbox, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";

function EntityFields(props: {
  draft: IndustryTemplateCustomField;
  isExisting: boolean;
  entityLabel: string;
  kindLabel: string;
  entityName: (entityType: string) => string;
  kindName: (kind: string) => string;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const { draft } = props;
  return (
    <>
      <FormField label={props.entityLabel} htmlFor="field-entity">
        <Select
          id="field-entity"
          value={draft.entityType}
          disabled={props.isExisting}
          onChange={(event) => props.onChange({ ...draft, entityType: event.target.value })}
        >
          {Object.values(CUSTOM_FIELD_ENTITY_TYPE).map((entityType) => (
            <option key={entityType} value={entityType}>
              {props.entityName(entityType)}
            </option>
          ))}
        </Select>
      </FormField>
      {draft.entityType === "offering" ? (
        <OfferingKindField
          draft={draft}
          isExisting={props.isExisting}
          kindLabel={props.kindLabel}
          kindName={props.kindName}
          onChange={props.onChange}
        />
      ) : null}
    </>
  );
}

function OfferingKindField(props: {
  draft: IndustryTemplateCustomField;
  isExisting: boolean;
  kindLabel: string;
  kindName: (kind: string) => string;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const { draft } = props;
  return (
    <FormField label={props.kindLabel} htmlFor="field-kind">
      <Select
        id="field-kind"
        value={draft.offeringKind ?? ""}
        disabled={props.isExisting}
        onChange={(event) =>
          props.onChange({
            ...draft,
            offeringKind: event.target.value as IndustryTemplateCustomField["offeringKind"],
          })
        }
      >
        {Object.values(OFFERING_KIND).map((kind) => (
          <option key={kind} value={kind}>
            {props.kindName(kind)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function FieldLabelInputs(props: {
  draft: IndustryTemplateCustomField;
  labelBn: string;
  labelEn: string;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const { draft } = props;
  return (
    <>
      <FormField label={props.labelBn} htmlFor="field-label-bn">
        <TextInput
          id="field-label-bn"
          value={draft.label?.bn ?? ""}
          onChange={(event) =>
            props.onChange({
              ...draft,
              label: { bn: event.target.value, en: draft.label?.en ?? "" },
            })
          }
        />
      </FormField>
      <FormField label={props.labelEn} htmlFor="field-label-en">
        <TextInput
          id="field-label-en"
          value={draft.label?.en ?? ""}
          onChange={(event) =>
            props.onChange({
              ...draft,
              label: { bn: draft.label?.bn ?? "", en: event.target.value },
            })
          }
        />
      </FormField>
    </>
  );
}

export function FieldIdentityFields(props: {
  draft: IndustryTemplateCustomField;
  isExisting: boolean;
  isTypeLocked: boolean;
  labels: IndustryLabels;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { draft } = props;
  return (
    <>
      <EntityFields
        draft={draft}
        isExisting={props.isExisting}
        entityLabel={t("platform.industry.field.entityType")}
        kindLabel={t("platform.industry.field.offeringKind")}
        entityName={(entityType) => t(`platform.entity.${entityType}`)}
        kindName={(kind) => t(`platform.kind.${kind}`)}
        onChange={props.onChange}
      />
      <FormField label={t("platform.industry.field.fieldKey")} htmlFor="field-key">
        <TextInput
          id="field-key"
          value={draft.fieldKey}
          disabled={props.isExisting}
          onChange={(event) => props.onChange({ ...draft, fieldKey: event.target.value })}
        />
      </FormField>
      <FormField label={t("platform.industry.field.fieldType")} htmlFor="field-type">
        <Select
          id="field-type"
          value={draft.fieldType}
          disabled={props.isTypeLocked}
          onChange={(event) =>
            props.onChange({
              ...draft,
              fieldType: event.target.value as IndustryTemplateCustomField["fieldType"],
            })
          }
        >
          {Object.values(CUSTOM_FIELD_TYPE).map((fieldType) => (
            <option key={fieldType} value={fieldType}>
              {t(`platform.fieldType.${fieldType}`)}
            </option>
          ))}
        </Select>
      </FormField>
      <FieldLabelInputs
        draft={draft}
        labelBn={t("platform.industry.field.labelBn")}
        labelEn={t("platform.industry.field.labelEn")}
        onChange={props.onChange}
      />
    </>
  );
}

export function FieldFlagFields(props: {
  draft: IndustryTemplateCustomField;
  labels: IndustryLabels;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { draft } = props;
  return (
    <>
      <Checkbox
        label={t("platform.industry.field.required")}
        checked={draft.isRequired}
        onChange={(event) => props.onChange({ ...draft, isRequired: event.target.checked })}
      />
      <Checkbox
        label={t("platform.industry.field.botAsk")}
        checked={draft.botAsk}
        onChange={(event) => props.onChange({ ...draft, botAsk: event.target.checked })}
      />
      <Checkbox
        label={t("platform.industry.field.searchable")}
        checked={draft.isSearchable}
        onChange={(event) => props.onChange({ ...draft, isSearchable: event.target.checked })}
      />
      <Checkbox
        id="field-sensitive"
        label={t("platform.industry.field.sensitive")}
        checked={draft.isSensitive}
        onChange={(event) => props.onChange({ ...draft, isSensitive: event.target.checked })}
      />
      <VisibilityFlags draft={draft} t={t} onChange={props.onChange} />
    </>
  );
}

function VisibilityFlags(props: {
  draft: IndustryTemplateCustomField;
  t: (key: string) => string;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const { draft } = props;
  function setVisibility(key: "admin" | "storefront" | "bot", checked: boolean): void {
    props.onChange({ ...draft, visibility: { ...draft.visibility, [key]: checked } });
  }
  return (
    <>
      <Checkbox
        label={props.t("platform.industry.field.visibilityAdmin")}
        checked={draft.visibility.admin}
        onChange={(event) => setVisibility("admin", event.target.checked)}
      />
      <Checkbox
        label={props.t("platform.industry.field.visibilityStorefront")}
        checked={draft.visibility.storefront}
        onChange={(event) => setVisibility("storefront", event.target.checked)}
      />
      <Checkbox
        label={props.t("platform.industry.field.visibilityBot")}
        checked={draft.visibility.bot}
        onChange={(event) => setVisibility("bot", event.target.checked)}
      />
    </>
  );
}

export function OptionFields(props: {
  draft: IndustryTemplateCustomField;
  labels: IndustryLabels;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const options = props.draft.options ?? [];
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <TextInput key={option} value={option} disabled />
      ))}
      <FormField label={t("platform.industry.field.optionValue")} htmlFor="field-option">
        <TextInput
          id="field-option"
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value.length === 0 || options.includes(value)) return;
            const label = { bn: value, en: value };
            props.onChange({
              ...props.draft,
              options: [...options, value],
              optionLabels: { ...props.draft.optionLabels, [value]: label },
            });
            event.target.value = "";
          }}
        />
      </FormField>
    </div>
  );
}
