"use client";

import { RELATION_KEY, type IndustryTemplateCustomField } from "@banijjik/contracts";
import { Checkbox, FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";

function ContactLinkFields(props: {
  draft: IndustryTemplateCustomField;
  labels: IndustryLabels;
  link: NonNullable<IndustryTemplateCustomField["link"]>;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { draft, link } = props;
  return (
    <>
      <FormField label={t("platform.industry.field.relationKey")} htmlFor="field-relation">
        <Select
          id="field-relation"
          value={link.relationKey}
          onChange={(event) =>
            props.onChange({
              ...draft,
              link: { ...link, relationKey: event.target.value as typeof link.relationKey },
            })
          }
        >
          {Object.values(RELATION_KEY).map((relationKey) => (
            <option key={relationKey} value={relationKey}>
              {t(`platform.relation.${relationKey}`)}
            </option>
          ))}
        </Select>
      </FormField>
      <Checkbox
        label={t("platform.industry.field.createIfMissing")}
        checked={link.createIfMissingByPhone}
        onChange={(event) =>
          props.onChange({
            ...draft,
            link: { ...link, createIfMissingByPhone: event.target.checked },
          })
        }
      />
      <Checkbox
        label={t("platform.industry.field.defaultBillTo")}
        checked={link.defaultBillTo}
        onChange={(event) =>
          props.onChange({ ...draft, link: { ...link, defaultBillTo: event.target.checked } })
        }
      />
    </>
  );
}

export function ReferenceFields(props: {
  draft: IndustryTemplateCustomField;
  labels: IndustryLabels;
  onChange: (draft: IndustryTemplateCustomField) => void;
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const { draft } = props;
  const link = draft.link ?? {
    relationKey: RELATION_KEY.GUARDIAN_OF,
    createIfMissingByPhone: false,
    defaultBillTo: false,
  };
  return (
    <>
      <FormField label={t("platform.industry.field.referenceEntity")} htmlFor="field-reference">
        <Select
          id="field-reference"
          value={draft.referenceEntity ?? ""}
          onChange={(event) =>
            props.onChange({
              ...draft,
              referenceEntity: event.target.value as IndustryTemplateCustomField["referenceEntity"],
            })
          }
        >
          <option value="contact">{t("platform.reference.contact")}</option>
          <option value="member">{t("platform.reference.member")}</option>
        </Select>
      </FormField>
      {draft.referenceEntity === "contact" ? (
        <ContactLinkFields
          draft={draft}
          labels={props.labels}
          link={link}
          onChange={props.onChange}
        />
      ) : null}
    </>
  );
}
