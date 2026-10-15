"use client";

import type { PlatformIndustryTemplateSummary } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { useTranslator } from "@banijjik/web-client/client";
import { Button, FormField, Select, TextInput, Textarea } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { createIndustryTemplate } from "../api/platform-api";
import { announceSuccess } from "../forms/announce-success";
import type { FormFailure } from "../forms/api-failure";
import { useFormSubmit } from "../forms/use-form-submit";
import {
  BLANK_ENABLED_KINDS,
  BLANK_MODULE_KEYS,
  blankIndustryConfiguration,
} from "./blank-configuration";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";

type Source = "empty" | "clone";

function createBody(input: {
  source: Source;
  templateKey: string;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
  descriptionEn: string;
  iconKey: string;
  reason: string;
  cloneFromIndustryTemplateId: string;
}) {
  const shared = {
    industryTemplateKey: input.templateKey,
    name: { bn: input.nameBn, en: input.nameEn },
    description: { bn: input.descriptionBn, en: input.descriptionEn },
    iconKey: input.iconKey,
    reason: input.reason,
  };
  if (input.source === "clone")
    return { ...shared, cloneFromIndustryTemplateId: input.cloneFromIndustryTemplateId };
  return {
    ...shared,
    enabledKinds: [...BLANK_ENABLED_KINDS],
    allowedModuleKeys: [...BLANK_MODULE_KEYS],
    configuration: blankIndustryConfiguration(),
  };
}

export function NewIndustryForm(props: {
  templates: readonly PlatformIndustryTemplateSummary[];
  labels: IndustryLabels;
  locale: "bn" | "en";
}): ReactElement {
  const t = labelsTranslator(props.labels);
  const errors = useTranslator().t;
  const router = useRouter();
  const submit = useFormSubmit();
  const draft = useDraft(props.templates[0]?.industryTemplateId ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const created = await submit.run(async () => {
      const detail = await createIndustryTemplate(createBody({ ...draft, source: draft.source }));
      await announceSuccess(t("platform.industry.created"));
      router.push(`/industry-templates/${detail.industryTemplateId}`);
    });
    void created;
  }

  return (
    <CreateIndustryFields
      t={t}
      templates={props.templates}
      locale={props.locale}
      draft={draft}
      failure={submit.failure}
      isSubmitting={submit.isSubmitting}
      errors={errors}
      onSubmit={handleSubmit}
    />
  );
}

interface Draft {
  source: Source;
  templateKey: string;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
  descriptionEn: string;
  iconKey: string;
  reason: string;
  cloneFromIndustryTemplateId: string;
  setSource: (source: Source) => void;
  setKey: (value: string) => void;
  setNameBn: (value: string) => void;
  setNameEn: (value: string) => void;
  setDescriptionBn: (value: string) => void;
  setDescriptionEn: (value: string) => void;
  setIconKey: (value: string) => void;
  setClone: (value: string) => void;
  setReason: (value: string) => void;
}

function useDraft(firstCloneId: string): Draft {
  const [source, setSource] = useState<Source>("clone");
  const [templateKey, setKey] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [iconKey, setIconKey] = useState("");
  const [cloneFromIndustryTemplateId, setClone] = useState(firstCloneId);
  const [reason, setReason] = useState("");
  return {
    source,
    templateKey,
    nameBn,
    nameEn,
    descriptionBn,
    descriptionEn,
    iconKey,
    reason,
    cloneFromIndustryTemplateId,
    setSource,
    setKey,
    setNameBn,
    setNameEn,
    setDescriptionBn,
    setDescriptionEn,
    setIconKey,
    setClone,
    setReason,
  };
}

function CreateIndustryFields(props: {
  t: Translator["t"];
  templates: readonly PlatformIndustryTemplateSummary[];
  locale: "bn" | "en";
  draft: Draft;
  failure: FormFailure | undefined;
  isSubmitting: boolean;
  errors: Translator["t"];
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}): ReactElement {
  const { t, draft } = props;
  return (
    <form
      onSubmit={(event) => void props.onSubmit(event)}
      noValidate
      className="flex max-w-xl flex-col gap-4"
    >
      <IdentityFields draft={draft} t={t} />
      <CloneChoice
        draft={draft}
        templates={props.templates}
        locale={props.locale}
        copyLabel={t("platform.industry.copyFrom")}
        emptyLabel={t("platform.industry.startEmpty")}
        cloneLabel={t("platform.industry.field.cloneFrom")}
      />
      <FormField label={t("platform.field.reason")} htmlFor="template-reason" required>
        <Textarea
          id="template-reason"
          value={draft.reason}
          onChange={(event) => draft.setReason(event.target.value)}
        />
      </FormField>
      {props.failure ? (
        <p role="alert" className="text-small text-danger">
          {props.errors(props.failure.messageKey, props.failure.values)}
        </p>
      ) : null}
      <Button type="submit" isLoading={props.isSubmitting}>
        {t("platform.industries.new")}
      </Button>
    </form>
  );
}

function IdentityFields(props: { draft: Draft; t: Translator["t"] }): ReactElement {
  const { draft, t } = props;
  return (
    <>
      <FormField label={t("platform.industry.field.key")} htmlFor="template-key" required>
        <TextInput
          id="template-key"
          value={draft.templateKey}
          onChange={(event) => draft.setKey(event.target.value)}
        />
      </FormField>
      <FormField label={t("platform.industry.field.nameBn")} htmlFor="template-name-bn" required>
        <TextInput
          id="template-name-bn"
          value={draft.nameBn}
          onChange={(event) => draft.setNameBn(event.target.value)}
        />
      </FormField>
      <FormField label={t("platform.industry.field.nameEn")} htmlFor="template-name-en" required>
        <TextInput
          id="template-name-en"
          value={draft.nameEn}
          onChange={(event) => draft.setNameEn(event.target.value)}
        />
      </FormField>
      <FormField
        label={t("platform.industry.field.descriptionBn")}
        htmlFor="template-description-bn"
        required
      >
        <Textarea
          id="template-description-bn"
          value={draft.descriptionBn}
          onChange={(event) => draft.setDescriptionBn(event.target.value)}
        />
      </FormField>
      <FormField
        label={t("platform.industry.field.descriptionEn")}
        htmlFor="template-description-en"
        required
      >
        <Textarea
          id="template-description-en"
          value={draft.descriptionEn}
          onChange={(event) => draft.setDescriptionEn(event.target.value)}
        />
      </FormField>
      <FormField label={t("platform.industry.field.iconKey")} htmlFor="template-icon" required>
        <TextInput
          id="template-icon"
          value={draft.iconKey}
          onChange={(event) => draft.setIconKey(event.target.value)}
        />
      </FormField>
    </>
  );
}

function CloneChoice(props: {
  draft: Draft;
  templates: readonly PlatformIndustryTemplateSummary[];
  locale: "bn" | "en";
  copyLabel: string;
  emptyLabel: string;
  cloneLabel: string;
}): ReactElement {
  const { draft } = props;
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-semibold">{props.copyLabel}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="radio"
            name="template-source"
            value="empty"
            checked={draft.source === "empty"}
            onChange={() => draft.setSource("empty")}
          />
          {props.emptyLabel}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="radio"
            name="template-source"
            value="clone"
            checked={draft.source === "clone"}
            onChange={() => draft.setSource("clone")}
          />
          {props.copyLabel}
        </label>
      </fieldset>
      {draft.source === "clone" ? (
        <FormField label={props.cloneLabel} htmlFor="template-clone">
          <Select
            id="template-clone"
            value={draft.cloneFromIndustryTemplateId}
            onChange={(event) => draft.setClone(event.target.value)}
          >
            {props.templates.map((template) => (
              <option key={template.industryTemplateId} value={template.industryTemplateId}>
                {template.name[props.locale]} ({template.industryTemplateKey})
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
    </>
  );
}
