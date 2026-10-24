"use client";

import {
  COMMISSION_SOURCE_TYPE,
  type CommissionEntryResponse,
} from "@banijjik/contracts/commission";
import { DataList, EmptyState, formatMoney, type DataListColumn } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import Link from "next/link";
import type { ReactElement } from "react";
import { entryKindLabelOf, entryStatusLabelOf } from "./commission-labels";

export interface CommissionEntryListProps {
  entries: readonly CommissionEntryResponse[];
  /** "My commission" has only the caller's entries, so the member column would always repeat one name. */
  showMember: boolean;
  /** Set on the business pages: an order-line entry then links to its order. */
  orgSlug?: string | undefined;
}

/** An order-line entry names its order by number, and the number links to the order when the page knows the business. */
function sourceCell(
  entry: CommissionEntryResponse,
  orgSlug: string | undefined,
  t: (key: string) => string,
): ReactElement | string {
  const label = entry.sourceNumber ?? t(`commission.source.${entry.sourceType}`);
  if (entry.sourceType !== COMMISSION_SOURCE_TYPE.ORDER_LINE || orgSlug === undefined) return label;
  return (
    <Link href={`/${orgSlug}/orders/${entry.sourceId}`} className="text-primary underline">
      {label}
    </Link>
  );
}

/** Commission entries: table from md, stacked cards below (the card layout cannot cross the server boundary). */
export function CommissionEntryList(props: CommissionEntryListProps): ReactElement {
  const { t, locale } = useTranslator();
  const columns: DataListColumn<CommissionEntryResponse>[] = [
    ...(props.showMember
      ? [
          {
            columnKey: "member",
            header: t("commission.entries.column.member"),
            isPrimary: true,
            cell: (entry: CommissionEntryResponse) => entry.memberName,
          },
        ]
      : []),
    {
      columnKey: "date",
      header: t("commission.entries.column.date"),
      isPrimary: true,
      cell: (entry) => entry.businessDate,
    },
    {
      columnKey: "amount",
      header: t("commission.entries.column.amount"),
      isPrimary: true,
      align: "end",
      cell: (entry) => formatMoney(entry.amount, { locale }),
    },
    {
      columnKey: "source",
      header: t("commission.entries.column.source"),
      cell: (entry) => sourceCell(entry, props.orgSlug, t),
    },
    {
      columnKey: "kind",
      header: t("commission.entries.column.kind"),
      cell: (entry) => entryKindLabelOf(entry.entryKind, t),
    },
    {
      columnKey: "status",
      header: t("commission.entries.column.status"),
      cell: (entry) => entryStatusLabelOf(entry.payoutId, t),
    },
  ];
  return (
    <DataList
      columns={columns}
      rows={[...props.entries]}
      rowKey={(entry) => entry.commissionEntryId}
      emptyState={<EmptyState message={t("commission.entries.empty")} />}
    />
  );
}
