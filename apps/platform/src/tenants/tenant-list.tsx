"use client";

import { DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { StatusPill } from "../shell/status-pill";
import type { StatusTone } from "@banijjik/ui";

export interface TenantRowView {
  organizationId: string;
  name: string;
  slug: string;
  templateKey: string;
  statusLabel: string;
  statusTone: StatusTone;
  subscriptionLabel: string;
  memberCountLabel: string;
}

export interface TenantListLabels {
  name: string;
  slug: string;
  template: string;
  status: string;
  subscription: string;
  members: string;
  empty: string;
}

function columnsOf(labels: TenantListLabels): DataListColumn<TenantRowView>[] {
  return [
    { columnKey: "name", header: labels.name, isPrimary: true, cell: (row) => row.name },
    { columnKey: "slug", header: labels.slug, cell: (row) => row.slug },
    { columnKey: "template", header: labels.template, cell: (row) => row.templateKey },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => <StatusPill tone={row.statusTone} label={row.statusLabel} />,
    },
    {
      columnKey: "subscription",
      header: labels.subscription,
      isPrimary: true,
      cell: (row) => row.subscriptionLabel,
    },
    {
      columnKey: "members",
      header: labels.members,
      align: "end",
      cell: (row) => row.memberCountLabel,
    },
  ];
}

/** The tenant list of 13-UX section 4.1: a dense table from md, cards below; a row opens the tenant. */
export function TenantList({
  rows,
  labels,
}: {
  rows: TenantRowView[];
  labels: TenantListLabels;
}): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.organizationId}
      onRowSelect={(row) => router.push(`/tenants/${row.organizationId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
