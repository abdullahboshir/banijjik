"use client";

import type { DirectoryReportReason } from "@banijjik/contracts/directory";
import type { Locale } from "@banijjik/i18n";
import { Button, FormField, Select, Textarea } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";
import { localizedText } from "../i18n/localized-text";

export interface ReportFormProps {
  readonly organizationId: string;
  readonly listingNumber: string;
  readonly locale: Locale;
  readonly reasons: readonly DirectoryReportReason[];
}

/** Reports a listing to the business's staff. The reason is a template key; the note is optional. */
export function ReportForm({
  organizationId,
  listingNumber,
  locale,
  reasons,
}: ReportFormProps): ReactElement {
  const t = translatorFor(locale).t;
  const [reasonKey, setReasonKey] = useState(reasons[0]?.reasonKey ?? "");
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [doneOrFailed, setDoneOrFailed] = useState<string | undefined>(undefined);

  async function submit(): Promise<void> {
    setIsBusy(true);
    const trimmed = note.trim();
    const result = await callStorefront(
      "POST",
      `/orgs/${organizationId}/listings/${encodeURIComponent(listingNumber)}/reports`,
      { body: trimmed === "" ? { reasonKey } : { reasonKey, note: trimmed } },
    );
    setIsBusy(false);
    setDoneOrFailed(result.ok ? "storefront.listing.reported" : "storefront.error.generic");
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormField label={t("storefront.listing.reportReason")} htmlFor="report-reason">
        <Select
          id="report-reason"
          name="reasonKey"
          value={reasonKey}
          onChange={(event) => setReasonKey(event.target.value)}
        >
          {reasons.map((reason) => (
            <option key={reason.reasonKey} value={reason.reasonKey}>
              {localizedText(reason.label, locale)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t("storefront.listing.reportNote")} htmlFor="report-note">
        <Textarea id="report-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </FormField>
      <Button type="submit" variant="secondary" isLoading={isBusy}>
        {t("storefront.listing.reportSubmit")}
      </Button>
      {doneOrFailed ? (
        <p role="status" className="text-body text-secondary">
          {t(doneOrFailed)}
        </p>
      ) : null}
    </form>
  );
}
