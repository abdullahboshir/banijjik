import type { StaffListingListItem } from "@banijjik/contracts/directory";
import type { Translator } from "@banijjik/i18n";
import { StatusBadge, buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { directoryListingsHref, type DirectoryListingsQuery } from "./directory-query";

export function DirectoryListingsRows(props: {
  orgSlug: string;
  items: readonly StaffListingListItem[];
  t: Translator["t"];
}): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {props.items.map((row) => (
        <li key={row.listingId}>
          <Link
            href={`/${props.orgSlug}/directory/listings/${row.listingId}`}
            className="flex min-h-11 flex-col gap-1 rounded-md border border-default p-4 hover:bg-subtle sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{row.listingNumber}</span>
              <StatusBadge
                requestType="LISTING"
                status={row.status}
                label={props.t(`directory.status.${row.status}`)}
              />
              {row.editedAfterApproval ? (
                <span className="text-caption text-warning">
                  {props.t("directory.badge.editedAfterApproval")}
                </span>
              ) : null}
            </div>
            <span className="text-small text-secondary">
              {Object.entries(row.customFields)
                .map(([, value]) => String(value))
                .join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DirectoryListingsPager(props: {
  basePath: string;
  query: DirectoryListingsQuery;
  hasNext: boolean;
  t: Translator["t"];
}): ReactElement {
  const { query, t } = props;
  return (
    <div className="flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link
          href={directoryListingsHref(props.basePath, { ...query, page: query.page - 1 })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("directory.page.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {t("directory.page.current", { page: String(query.page) })}
      </span>
      {props.hasNext ? (
        <Link
          href={directoryListingsHref(props.basePath, { ...query, page: query.page + 1 })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("directory.page.next")}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
