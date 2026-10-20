import type { EffectiveCustomField } from "@banijjik/contracts";
import type { DirectoryConfigResponse, ListingResponse } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { PageSection, PublicImage } from "@banijjik/ui";
import type { ReactElement } from "react";
import { detailRowsOf, type DetailRow } from "../custom-fields/custom-field-display";
import { sectionBlocksOf } from "./section-blocks";
import { listingTierLabelOf } from "./tier-labels";

export interface ListingSectionsProps {
  listing: ListingResponse;
  fields: readonly EffectiveCustomField[];
  sections: DirectoryConfigResponse["sections"];
  locale: Locale;
  timeZone: string;
  currencyCode: string;
  t: Translator["t"];
  photoUrls: readonly string[];
  photosTitle: string;
  photosHelp: string;
}

function FieldRow(props: { row: DetailRow; tierLabel: string; notSet: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1 border-b border-default py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <dt className="text-small text-secondary">{props.row.label}</dt>
        <span className="rounded-full border border-default px-2 py-0.5 text-caption text-secondary">
          {props.tierLabel}
        </span>
      </div>
      <dd className="break-words text-body text-primary">
        {props.row.isHidden || props.row.text === undefined ? props.notSet : props.row.text}
      </dd>
    </div>
  );
}

function PhotoGrid(props: { urls: readonly string[]; title: string; help: string }): ReactElement {
  return (
    <PageSection title={props.title} help={props.help}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {props.urls.map((url) => (
          <li key={url}>
            <PublicImage
              src={url}
              alt=""
              className="aspect-square w-full rounded-md object-cover"
            />
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

/** Listing answers by template section, with a visibility tier chip on every field. */
export function ListingSections(props: ListingSectionsProps): ReactElement {
  const notSet = props.t("directory.field.notSet");
  const blocks = sectionBlocksOf({
    fields: props.fields,
    sections: props.sections,
    locale: props.locale,
    otherTitle: props.t("directory.section.other"),
  });
  return (
    <div className="flex flex-col gap-6">
      {props.photoUrls.length > 0 ? (
        <PhotoGrid urls={props.photoUrls} title={props.photosTitle} help={props.photosHelp} />
      ) : null}
      {blocks.map((block) => {
        if (block.fields.length === 0) return null;
        const rows = detailRowsOf({
          fields: block.fields,
          values: props.listing.customFields,
          canSeeSensitive: true,
          locale: props.locale,
          timeZone: props.timeZone,
          currencyCode: props.currencyCode,
          t: props.t,
        });
        return (
          <PageSection key={block.key} title={block.title}>
            <dl>
              {rows.map((row) => {
                const field = block.fields.find((candidate) => candidate.fieldKey === row.fieldKey);
                return (
                  <FieldRow
                    key={row.fieldKey}
                    row={row}
                    tierLabel={listingTierLabelOf(field?.listingTier, props.t)}
                    notSet={notSet}
                  />
                );
              })}
            </dl>
          </PageSection>
        );
      })}
    </div>
  );
}
