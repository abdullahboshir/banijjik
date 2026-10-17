"use client";

import type {
  IndustryTemplateConfiguration,
  IndustryTemplateCustomField,
} from "@banijjik/contracts";
import type { Locale } from "@banijjik/i18n";
import { useLazyComponent } from "@banijjik/web-client/client";
import { Button } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import { emptyCustomField } from "./empty-custom-field";
import type { FieldEditorSheetProps } from "./field-editor-sheet";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { writeConfiguration } from "./write-configuration";
import type { TemplatePatch } from "./use-template-save";

interface EditorTarget {
  field: IndustryTemplateCustomField;
  isExisting: boolean;
}

function fieldIdentity(field: IndustryTemplateCustomField): string {
  return `${field.entityType}:${field.offeringKind ?? ""}:${field.fieldKey}`;
}

async function loadSheet(): Promise<ComponentType<FieldEditorSheetProps>> {
  const sheetModule = await import("./field-editor-sheet");
  return sheetModule.FieldEditorSheet;
}

interface FieldsSectionProps {
  configuration: IndustryTemplateConfiguration;
  locale: Locale;
  canWrite: boolean;
  refusesRemoval: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}

export function FieldsSection(props: FieldsSectionProps): ReactElement {
  const { configuration, locale, canWrite, refusesRemoval, labels, onSave } = props;
  const t = labelsTranslator(labels);
  const [fields, setFields] = useState<IndustryTemplateCustomField[]>([
    ...configuration.customFields,
  ]);
  const [original] = useState(() => new Set(configuration.customFields.map(fieldIdentity)));
  const [target, setTarget] = useState<EditorTarget | undefined>();
  const Sheet = useLazyComponent(loadSheet, target !== undefined);

  function apply(field: IndustryTemplateCustomField): void {
    const identity = fieldIdentity(field);
    const exists = fields.some((item) => fieldIdentity(item) === identity);
    setFields(
      exists
        ? fields.map((item) => (fieldIdentity(item) === identity ? field : item))
        : [...fields, field],
    );
  }

  return (
    <IndustrySection
      title={t("platform.industry.section.fields")}
      help={t("platform.industry.section.fields.help")}
    >
      <FieldGroups
        fields={fields}
        locale={locale}
        canRemove={canWrite}
        refusesRemoval={refusesRemoval}
        original={original}
        labels={labels}
        onEdit={(field) => setTarget({ field, isExisting: true })}
        onRemove={(field) =>
          setFields(fields.filter((item) => fieldIdentity(item) !== fieldIdentity(field)))
        }
      />
      <FieldActions
        canWrite={canWrite}
        addLabel={t("platform.industry.action.addField")}
        saveLabel={t("platform.industry.action.save")}
        onAdd={() => setTarget({ field: emptyCustomField(), isExisting: false })}
        onSave={() =>
          onSave({ configuration: writeConfiguration({ ...configuration, customFields: fields }) })
        }
        sheet={
          Sheet && target ? (
            <Sheet
              field={target.field}
              isExisting={target.isExisting}
              isTypeLocked={refusesRemoval}
              labels={labels}
              onApply={apply}
              onClose={() => setTarget(undefined)}
            />
          ) : null
        }
      />
    </IndustrySection>
  );
}

function FieldActions(props: {
  canWrite: boolean;
  addLabel: string;
  saveLabel: string;
  onAdd: () => void;
  onSave: () => void;
  sheet: ReactElement | null;
}): ReactElement {
  if (!props.canWrite) return <>{props.sheet}</>;
  return (
    <>
      <Button id="add-field" variant="secondary" onClick={props.onAdd}>
        {props.addLabel}
      </Button>
      <Button id="save-fields" onClick={props.onSave}>
        {props.saveLabel}
      </Button>
      {props.sheet}
    </>
  );
}

function FieldGroups(props: {
  fields: readonly IndustryTemplateCustomField[];
  locale: Locale;
  canRemove: boolean;
  refusesRemoval: boolean;
  original: ReadonlySet<string>;
  labels: IndustryLabels;
  onEdit: (field: IndustryTemplateCustomField) => void;
  onRemove: (field: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const groups = new Map<string, IndustryTemplateCustomField[]>();
  for (const field of props.fields) {
    const group = groups.get(field.entityType) ?? [];
    group.push(field);
    groups.set(field.entityType, group);
  }
  if (props.fields.length === 0) return <p>{t("platform.industry.fields.empty")}</p>;
  return (
    <div className="flex flex-col gap-3">
      {[...groups.entries()].map(([entityType, fields]) => (
        <section key={entityType}>
          <h3 className="text-small font-semibold text-primary">
            {t(`platform.entity.${entityType}`)}
          </h3>
          {fields.map((field) => (
            <FieldRow
              key={fieldIdentity(field)}
              field={field}
              locale={props.locale}
              canRemove={
                props.canRemove &&
                !(props.refusesRemoval && props.original.has(fieldIdentity(field)))
              }
              labels={props.labels}
              onEdit={() => props.onEdit(field)}
              onRemove={() => props.onRemove(field)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function FieldRow(props: {
  field: IndustryTemplateCustomField;
  locale: Locale;
  canRemove: boolean;
  labels: IndustryLabels;
  onEdit: () => void;
  onRemove: () => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { field } = props;
  const label = field.label?.[props.locale] ?? field.fieldKey;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-default py-2">
      <button type="button" className="min-h-11 text-left" onClick={props.onEdit}>
        {label}
      </button>
      <span className="text-small text-secondary">{field.fieldKey}</span>
      <span className="text-small text-secondary">
        {t(`platform.fieldType.${field.fieldType}`)}
      </span>
      {field.isRequired ? <Badge text={t("platform.industry.badge.required")} /> : null}
      {field.botAsk ? <Badge text={t("platform.industry.badge.botAsk")} /> : null}
      {field.isSensitive ? <Badge text={t("platform.industry.badge.sensitive")} /> : null}
      {props.canRemove ? (
        <Button variant="secondary" onClick={props.onRemove}>
          {t("platform.industry.action.remove")}
        </Button>
      ) : null}
    </div>
  );
}

function Badge({ text }: { text: string }): ReactElement {
  return (
    <span className="rounded-full bg-subtle px-2 py-1 text-caption text-secondary">{text}</span>
  );
}
