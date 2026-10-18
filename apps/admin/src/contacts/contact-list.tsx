"use client";

import { DataList, EmptyState, StatusBadge, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

export interface ContactRowView {
  contactId: string;
  name: string;
  phone: string;
  roles: string;
  /** The contact status, for the badge colour. */
  status: string;
  statusLabel: string;
}

export interface ContactListLabels {
  name: string;
  phone: string;
  roles: string;
  status: string;
  empty: string;
}

export interface ContactListProps {
  rows: ContactRowView[];
  labels: ContactListLabels;
  /** `/acme/contacts`: a row opens `${detailBasePath}/${contactId}`. */
  detailBasePath: string;
}

function columnsOf(labels: ContactListLabels): DataListColumn<ContactRowView>[] {
  return [
    { columnKey: "name", header: labels.name, isPrimary: true, cell: (row) => row.name },
    { columnKey: "phone", header: labels.phone, isPrimary: true, cell: (row) => row.phone },
    { columnKey: "roles", header: labels.roles, cell: (row) => row.roles },
    {
      columnKey: "status",
      header: labels.status,
      cell: (row) => (
        <StatusBadge requestType="CONTACT" status={row.status} label={row.statusLabel} />
      ),
    },
  ];
}

/** The contact list of 13-UX section 4.1: a table from md, cards below; a row opens the contact. */
export function ContactList({ rows, labels, detailBasePath }: ContactListProps): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.contactId}
      onRowSelect={(row) => router.push(`${detailBasePath}/${row.contactId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
