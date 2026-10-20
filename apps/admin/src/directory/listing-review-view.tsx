import type { EffectiveCustomField } from "@banijjik/contracts";
import type { DirectoryConfigResponse, ListingResponse } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import type { CurrencyCode } from "@banijjik/contracts";
import { PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { LazyListingSections } from "./lazy-listing-sections";
import { ListingReviewHeader } from "./listing-review-header";
import { ReviewActions } from "./review-actions";
import type { ReviewActionsLabels } from "./review-actions";

export function ListingReviewView(props: {
  listing: ListingResponse;
  config: DirectoryConfigResponse;
  fields: readonly EffectiveCustomField[];
  organizationId: string;
  locale: Locale;
  timeZone: string;
  currencyCode: CurrencyCode;
  t: Translator["t"];
  term: string;
  queueHref: string;
  photoUrls: readonly string[];
  canReview: boolean;
  canHide: boolean;
  labels: ReviewActionsLabels;
}): ReactElement {
  const { listing, t } = props;
  return (
    <PageLayout
      title={listing.listingNumber}
      subtitle={t("directory.review.subtitle", { term: props.term })}
      actions={<ListingReviewHeader listing={listing} queueHref={props.queueHref} t={t} />}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <LazyListingSections
          listing={listing}
          fields={props.fields}
          sections={props.config.sections}
          locale={props.locale}
          timeZone={props.timeZone}
          currencyCode={props.currencyCode}
          t={t}
          photoUrls={props.photoUrls}
          photosTitle={t("directory.photos.title")}
          photosHelp={t("directory.photos.help")}
        />
        <ReviewActions
          organizationId={props.organizationId}
          listingId={listing.listingId}
          version={listing.version}
          status={listing.status}
          canReview={props.canReview}
          canHide={props.canHide}
          reasons={props.config.rejectionReasons}
          locale={props.locale}
          queueHref={props.queueHref}
          labels={props.labels}
        />
      </div>
    </PageLayout>
  );
}
