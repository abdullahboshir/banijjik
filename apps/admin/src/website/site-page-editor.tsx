"use client";

import type { SitePageKey, SitePageResponse } from "@banijjik/contracts/website";
import { Button, FormField, Textarea, TextInput, renderMarkdown } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useState, type ReactElement } from "react";
import { isVersionConflict } from "../directory/review-run";
import { draftOf, draftProblemKeys, upsertBodyOf, type SitePageDraft } from "./site-page-draft";
import { saveSitePage } from "./website-api";

export interface SitePageEditorProps {
  readonly organizationId: string;
  readonly page: SitePageResponse;
  readonly canEdit: boolean;
}

type Locale = "bn" | "en";
const LOCALES: readonly Locale[] = ["bn", "en"];

/** One static page: a title and a Markdown body per language, a publish switch, a preview, a versioned save. */
export function SitePageEditor({
  organizationId,
  page,
  canEdit,
}: SitePageEditorProps): ReactElement {
  const { t } = useTranslator();
  const [draft, setDraft] = useState<SitePageDraft>(draftOf(page));
  const [version, setVersion] = useState(page.version);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const problems = draftProblemKeys(draft);

  async function save(): Promise<void> {
    if (problems.length > 0) return setNotice(problems[0]);
    setIsBusy(true);
    setNotice(undefined);
    try {
      const saved = await saveSitePage(organizationId, page.pageKey, upsertBodyOf(draft, version));
      setVersion(saved.version);
      setNotice("website.pages.saved");
    } catch (error) {
      setNotice(isVersionConflict(error) ? "website.pages.conflict" : "website.pages.failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-default p-4">
      <h2 className="text-title font-semibold text-primary">
        {t(`website.pages.${page.pageKey}`)}
      </h2>
      {LOCALES.map((locale) => (
        <LocaleFields
          key={locale}
          pageKey={page.pageKey}
          locale={locale}
          draft={draft}
          canEdit={canEdit}
          onChange={setDraft}
          t={t}
        />
      ))}
      <PublishSwitch
        checked={draft.isPublished}
        disabled={!canEdit || isBusy}
        label={t("website.pages.publish")}
        onChange={(isPublished) => setDraft({ ...draft, isPublished })}
      />
      {notice ? (
        <p role="alert" className="text-body text-secondary">
          {t(notice)}
        </p>
      ) : null}
      {canEdit ? (
        <Button variant="primary" isLoading={isBusy} onClick={() => void save()}>
          {t("website.pages.save")}
        </Button>
      ) : (
        <p className="text-small text-secondary">{t("website.pages.readOnly")}</p>
      )}
    </section>
  );
}

interface LocaleFieldsProps {
  readonly pageKey: SitePageKey;
  readonly locale: Locale;
  readonly draft: SitePageDraft;
  readonly canEdit: boolean;
  readonly onChange: (draft: SitePageDraft) => void;
  readonly t: (key: string) => string;
}

/** The title and body of one language, with the body's preview under it. */
function LocaleFields({
  pageKey,
  locale,
  draft,
  canEdit,
  onChange,
  t,
}: LocaleFieldsProps): ReactElement {
  const titleId = `page-title-${pageKey}-${locale}`;
  const bodyId = `page-body-${pageKey}-${locale}`;
  const languageName = t(`website.pages.language.${locale}`);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-body font-semibold text-primary">{languageName}</legend>
      <FormField label={t("website.pages.titleLabel")} htmlFor={titleId}>
        <TextInput
          id={titleId}
          value={draft.title[locale]}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({ ...draft, title: { ...draft.title, [locale]: event.target.value } })
          }
        />
      </FormField>
      <FormField
        label={t("website.pages.bodyLabel")}
        htmlFor={bodyId}
        hint={t("website.pages.bodyHint")}
      >
        <Textarea
          id={bodyId}
          rows={8}
          value={draft.body[locale]}
          disabled={!canEdit}
          onChange={(event) =>
            onChange({ ...draft, body: { ...draft.body, [locale]: event.target.value } })
          }
        />
      </FormField>
      <div className="rounded-md bg-subtle p-3 text-body text-primary">
        <p className="text-small text-secondary">{t("website.pages.preview")}</p>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.body[locale]) }} />
      </div>
    </fieldset>
  );
}

function PublishSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="flex min-h-11 items-center gap-3 text-body text-primary">
      <input
        type="checkbox"
        className="size-5"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
