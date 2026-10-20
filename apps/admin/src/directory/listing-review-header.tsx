import type { ListingResponse } from "@banijjik/contracts/directory";
import type { Translator } from "@banijjik/i18n";
import { StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";

export function ListingReviewHeader(props: {
  listing: ListingResponse;
  queueHref: string;
  t: Translator["t"];
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge
        requestType="LISTING"
        status={props.listing.status}
        label={props.t(`directory.status.${props.listing.status}`)}
      />
      <Link href={props.queueHref} className="text-small font-semibold text-brand">
        {props.t("directory.review.backToQueue")}
      </Link>
    </div>
  );
}
