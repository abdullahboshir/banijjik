import type { ListingReportQueueItem } from "@banijjik/contracts/directory";
import { StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";

export interface ReportQueueCardLabels {
  openCount: string;
  reasons: string;
  oldest: string;
  open: string;
  status: string;
  reasonNames: readonly string[];
  age: string;
}

/** One listing with open reports in the staff queue (M.7 decision 12). */
export function ReportQueueCard(props: {
  item: ListingReportQueueItem;
  href: string;
  labels: ReportQueueCardLabels;
}): ReactElement {
  const { item, labels } = props;
  return (
    <Link
      href={props.href}
      className="flex min-h-11 flex-col gap-2 rounded-md border border-default bg-surface p-4 text-primary transition-colors hover:bg-subtle"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{item.listingNumber}</span>
        <StatusBadge requestType="LISTING" status={item.listingStatus} label={labels.status} />
        <span className="rounded-full border border-warning px-2 py-0.5 text-caption text-warning">
          {labels.openCount}
        </span>
      </div>
      <dl className="grid gap-1 text-small">
        <div className="flex gap-2">
          <dt className="text-secondary">{labels.reasons}</dt>
          <dd className="min-w-0 break-words">{labels.reasonNames.join(", ")}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-secondary">{labels.oldest}</dt>
          <dd>{labels.age}</dd>
        </div>
      </dl>
      <span className="text-small font-semibold text-brand">{labels.open}</span>
    </Link>
  );
}
