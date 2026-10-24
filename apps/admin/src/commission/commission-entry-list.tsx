"use client";

import type { CommissionEntryResponse } from "@banijjik/contracts/commission";
import { DataList, EmptyState, formatMoney, type DataListColumn } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import { entryKindLabelOf, entryStatusLabelOf } from "./commission-labels";

export interface CommissionEntryListProps {
  entries: readonly CommissionEntryResponse[];
  /** "My commission" has only the caller's entries, so the member column would always repeat one name. */
  showMember: boolean;
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
      cell: (entry) => entry.sourceNumber ?? t("commission.source.BOOKING"),
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
