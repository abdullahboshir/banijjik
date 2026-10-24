import type { ListingListItem, StorefrontListingField } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import Link from "next/link";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import { fieldValueText } from "../search/field-value";

const CARD_FIELD_LIMIT = 4;

export interface ListingCardProps {
  readonly listing: ListingListItem;
  readonly fields: readonly StorefrontListingField[];
  readonly locale: Locale;
  readonly translator: Translator;
}

/** One row of search results: the first few fields the visitor may see. */
export function ListingCard({
  listing,
  fields,
  locale,
  translator,
}: ListingCardProps): ReactElement {
  const rows = fields
    .map((field) => ({
      field,
      text: fieldValueText({
        field,
        value: listing.customFields[field.fieldKey],
        locale,
        translator,
      }),
    }))
    .filter((row): row is { field: StorefrontListingField; text: string } => row.text !== undefined)
    .slice(0, CARD_FIELD_LIMIT);
  return (
    <li>
      <Link
        href={`/listings/${encodeURIComponent(listing.listingNumber)}`}
        className="flex flex-col gap-2 rounded-md border border-default bg-surface p-4 hover:bg-subtle"
      >
        <span className="text-small text-secondary">
          {translator.t("storefront.listing.number", { number: listing.listingNumber })}
        </span>
        <dl className="grid grid-cols-1 gap-1 text-body sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.field.fieldKey} className="flex gap-2">
              <dt className="text-secondary">{localizedText(row.field.label, locale)}:</dt>
              <dd className="font-semibold text-primary">{row.text}</dd>
            </div>
          ))}
        </dl>
      </Link>
    </li>
  );
}
