"use client";

import type { TermChange } from "@banijjik/contracts";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { TERM_TEXT_MAX_LENGTH } from "@banijjik/validation";
import { useState, type FormEvent, type ReactElement } from "react";
import { updateTerms } from "../lib/api/tenant-config-api";
import { SettingsTextField } from "../settings/settings-text-field";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import type { TermSheetLabels } from "./term-labels";
import type { TermLocale, TermRowView } from "./term-rows";

export interface TermEditSheetProps {
  organizationId: string;
  term: TermRowView;
  labels: TermSheetLabels;
  onClose: () => void;
}

const LOCALES: readonly TermLocale[] = ["bn", "en"];
const RESET_ACTION = "reset";
const REQUIRED_KEY = "validation.required";
const TOO_LONG_KEY = "validation.too_big";

type Texts = Record<TermLocale, string>;

/** Per language the person changed: a trimmed text of 1 to 40 characters, or the field error. */
function changesFrom(
  term: TermRowView,
  texts: Texts,
): { items: TermChange[]; fieldErrors: Record<string, string> } {
  const items: TermChange[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const locale of LOCALES) {
    const text = texts[locale].trim();
    const current = term[locale];
    if (text === current.text) continue;
    if (text.length === 0) fieldErrors[locale] = REQUIRED_KEY;
    else if (text.length > TERM_TEXT_MAX_LENGTH) fieldErrors[locale] = TOO_LONG_KEY;
    else {
      items.push({
        termKey: term.termKey,
        locale,
        text,
        ...(current.version === undefined ? {} : { version: current.version }),
      });
    }
  }
  return { items, fieldErrors };
}

/** Removes the business's own text of each language that has one, so the template text returns. */
function resetItems(term: TermRowView): TermChange[] {
  return LOCALES.flatMap((locale) => {
    const { source, version } = term[locale];
    if (source !== "ORGANIZATION" || version === undefined) return [];
    return [{ termKey: term.termKey, locale, text: null, version }];
  });
}

/** Renames one term in both languages, or resets it. A stale version is a 409 with a reload hint. */
export function TermEditSheet(props: TermEditSheetProps): ReactElement {
  const { organizationId, term, labels } = props;
  const [texts, setTexts] = useState<Texts>({ bn: term.bn.text, en: term.en.text });

  async function send(action: string): Promise<SheetSendResult> {
    const changes =
      action === RESET_ACTION
        ? { items: resetItems(term), fieldErrors: {} }
        : changesFrom(term, texts);
    if (Object.keys(changes.fieldErrors).length > 0) {
      return { ok: false, fieldErrors: changes.fieldErrors };
    }
    if (changes.items.length > 0) await updateTerms(organizationId, changes.items);
    return { ok: true };
  }

  const state = useSheetSubmit({ fieldNames: LOCALES, onClose: props.onClose, send });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  const hasOwnText = resetItems(term).length > 0;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={term.label} closeLabel={labels.close}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {LOCALES.map((locale) => (
            <SettingsTextField
              key={locale}
              fieldId={`term-${locale}`}
              label={labels[locale]}
              value={texts[locale]}
              errorKey={state.errors[locale]}
              isRequired
              onChange={(text) => setTexts({ ...texts, [locale]: text })}
            />
          ))}
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
          {hasOwnText ? (
            <Button variant="secondary" onClick={() => void state.submit(RESET_ACTION)}>
              {labels.reset}
            </Button>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}
