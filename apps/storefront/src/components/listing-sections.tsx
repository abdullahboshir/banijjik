import type {
  ListingResponse,
  StorefrontDirectoryFormResponse,
} from "@banijjik/contracts/directory";
import type { StorefrontListingField } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import { fieldValueText } from "../search/field-value";

export interface ListingSectionsProps {
  readonly listing: ListingResponse;
  readonly form: StorefrontDirectoryFormResponse;
  readonly locale: Locale;
  readonly translator: Translator;
}

interface ShownRow {
  readonly field: StorefrontListingField;
  readonly text: string;
}

interface ShownRowsInput {
  readonly fields: readonly StorefrontListingField[];
  readonly listing: ListingResponse;
  readonly locale: Locale;
  readonly translator: Translator;
}

function shownRowsOf({ fields, listing, locale, translator }: ShownRowsInput): ShownRow[] {
  const rows: ShownRow[] = [];
  for (const field of fields) {
    const text = fieldValueText({
      field,
      value: listing.customFields[field.fieldKey],
      locale,
      translator,
    });
    if (text !== undefined) rows.push({ field, text });
  }
  return rows;
}

interface SectionGroup {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly ShownRow[];
}

function sectionGroupsOf({
  form,
  listing,
  locale,
  translator,
}: ListingSectionsProps): SectionGroup[] {
  const knownSectionKeys = new Set(form.sections.map((section) => section.sectionKey));
  const sectionGroups = form.sections.map((section) => ({
    key: section.sectionKey,
    title: localizedText(section.label, locale),
    rows: shownRowsOf({
      fields: form.fields.filter((field) => field.sectionKey === section.sectionKey),
      listing,
      locale,
      translator,
    }),
  }));
  const unsectionedFields = form.fields.filter(
    (field) => field.sectionKey === undefined || !knownSectionKeys.has(field.sectionKey),
  );
  const unsectioned = shownRowsOf({ fields: unsectionedFields, listing, locale, translator });
  return [
    ...sectionGroups,
    { key: "details", title: translator.t("storefront.listing.details"), rows: unsectioned },
  ];
}

/** The listing's details, grouped by the template's sections, with the fields that have a value. */
export function ListingSections(props: ListingSectionsProps): ReactElement {
  const { locale } = props;
  const groups = sectionGroupsOf(props).filter((group) => group.rows.length > 0);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <PageSection key={group.key} title={group.title}>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.rows.map((row) => (
              <div key={row.field.fieldKey} className="flex flex-col gap-1">
                <dt className="text-small text-secondary">
                  {localizedText(row.field.label, locale)}
                </dt>
                <dd className="text-body text-primary">{row.text}</dd>
              </div>
            ))}
          </dl>
        </PageSection>
      ))}
    </div>
  );
}
