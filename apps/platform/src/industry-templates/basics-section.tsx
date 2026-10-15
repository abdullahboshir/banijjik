"use client";

import type { LocalizedText } from "@banijjik/contracts";
import { Button, FormField, TextInput, Textarea } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { IndustrySection } from "./industry-section";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import type { TemplatePatch } from "./use-template-save";

function TextPair(props: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  multiline: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  const input = props.multiline ? (
    <Textarea
      id={props.id}
      value={props.value}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ) : (
    <TextInput
      id={props.id}
      value={props.value}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
  return (
    <FormField label={props.label} htmlFor={props.id}>
      {input}
    </FormField>
  );
}

export function BasicsSection({
  name,
  description,
  iconKey,
  canWrite,
  labels,
  onSave,
}: {
  name: LocalizedText;
  description: LocalizedText;
  iconKey: string;
  canWrite: boolean;
  labels: IndustryLabels;
  onSave: (patch: TemplatePatch) => void;
}): ReactElement {
  const t = labelsTranslator(labels);
  const [draftName, setName] = useState(name);
  const [draftDescription, setDescription] = useState(description);
  const [draftIcon, setIcon] = useState(iconKey);
  return (
    <IndustrySection title={t("platform.industry.section.basics")}>
      <BasicsFields
        t={t}
        canWrite={canWrite}
        draftName={draftName}
        draftDescription={draftDescription}
        draftIcon={draftIcon}
        onName={setName}
        onDescription={setDescription}
        onIcon={setIcon}
      />
      {canWrite ? (
        <Button
          id="save-basics"
          onClick={() =>
            onSave({ name: draftName, description: draftDescription, iconKey: draftIcon })
          }
        >
          {t("platform.industry.action.save")}
        </Button>
      ) : null}
    </IndustrySection>
  );
}

function BasicsFields(props: {
  t: (key: string) => string;
  canWrite: boolean;
  draftName: LocalizedText;
  draftDescription: LocalizedText;
  draftIcon: string;
  onName: (name: LocalizedText) => void;
  onDescription: (description: LocalizedText) => void;
  onIcon: (iconKey: string) => void;
}): ReactElement {
  const { t, draftName, draftDescription } = props;
  return (
    <>
      <TextPair
        id="basics-name-bn"
        label={t("platform.industry.field.nameBn")}
        value={draftName.bn}
        disabled={!props.canWrite}
        multiline={false}
        onChange={(bn) => props.onName({ ...draftName, bn })}
      />
      <TextPair
        id="basics-name-en"
        label={t("platform.industry.field.nameEn")}
        value={draftName.en}
        disabled={!props.canWrite}
        multiline={false}
        onChange={(en) => props.onName({ ...draftName, en })}
      />
      <TextPair
        id="basics-description-bn"
        label={t("platform.industry.field.descriptionBn")}
        value={draftDescription.bn}
        disabled={!props.canWrite}
        multiline
        onChange={(bn) => props.onDescription({ ...draftDescription, bn })}
      />
      <TextPair
        id="basics-description-en"
        label={t("platform.industry.field.descriptionEn")}
        value={draftDescription.en}
        disabled={!props.canWrite}
        multiline
        onChange={(en) => props.onDescription({ ...draftDescription, en })}
      />
      <TextPair
        id="basics-icon"
        label={t("platform.industry.field.iconKey")}
        value={props.draftIcon}
        disabled={!props.canWrite}
        multiline={false}
        onChange={props.onIcon}
      />
    </>
  );
}
