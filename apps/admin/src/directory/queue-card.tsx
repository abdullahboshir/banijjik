import type { ListingResponse } from "@banijjik/contracts/directory";
import type { EffectiveCustomField } from "@banijjik/contracts";
import type { Locale } from "@banijjik/i18n";
import { StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { labelOf } from "../custom-fields/custom-field-display";

export interface QueueCardLabels {
  editedAfterApproval: string;
  submittedAt: string;
  open: string;
  status: (status: string) => string;
}

export interface QueueCardProps {
  listing: ListingResponse;
  href: string;
  /** Fields of the template's first section (PUBLIC preview on the card). */
  previewFields: readonly EffectiveCustomField[];
  locale: Locale;
  labels: QueueCardLabels;
}

function editedAfterApproval(listing: ListingResponse): boolean {
  return listing.status === "SUBMITTED" && listing.reviewedAt !== null;
}

function previewLines(
  listing: ListingResponse,
  fields: readonly EffectiveCustomField[],
  locale: Locale,
): readonly { label: string; value: string }[] {
  return fields.flatMap((field) => {
    const value = listing.customFields[field.fieldKey];
    if (value === undefined || value === null || value === "") return [];
    return [{ label: labelOf(field.label, locale), value: String(value) }];
  });
}

/** One SUBMITTED listing in the review queue (plan M.3). */
export function QueueCard(props: QueueCardProps): ReactElement {
  const { listing, labels } = props;
  const lines = previewLines(listing, props.previewFields, props.locale);
  return (
    <Link
      href={props.href}
      className="flex min-h-11 flex-col gap-2 rounded-md border border-default bg-surface p-4 text-primary transition-colors hover:bg-subtle"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{listing.listingNumber}</span>
        <StatusBadge
          requestType="LISTING"
          status={listing.status}
          label={labels.status(listing.status)}
        />
        {editedAfterApproval(listing) ? (
          <span className="rounded-full border border-warning px-2 py-0.5 text-caption text-warning">
            {labels.editedAfterApproval}
          </span>
        ) : null}
      </div>
      {listing.submittedAt ? (
        <p className="text-small text-secondary">
          {labels.submittedAt}:{" "}
          {new Intl.DateTimeFormat(props.locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(listing.submittedAt))}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <dl className="grid gap-1 text-small">
          {lines.map((line) => (
            <div key={line.label} className="flex gap-2">
              <dt className="text-secondary">{line.label}</dt>
              <dd className="break-words">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <span className="text-small font-semibold text-brand">{labels.open}</span>
    </Link>
  );
}
