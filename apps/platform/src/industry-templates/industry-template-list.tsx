"use client";

import { DataList, EmptyState, type DataListColumn, type StatusTone } from "@banijjik/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { StatusPill } from "../shell/status-pill";

export interface IndustryTemplateRowView {
  industryTemplateId: string;
  name: string;
  industryTemplateKey: string;
  kinds: string;
  moduleCountLabel: string;
  versionLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
}

export interface IndustryTemplateListLabels {
  name: string;
  key: string;
  kinds: string;
  modules: string;
  version: string;
  status: string;
  empty: string;
}

function columnsOf(labels: IndustryTemplateListLabels): DataListColumn<IndustryTemplateRowView>[] {
  return [
    {
      columnKey: "name",
      header: labels.name,
      isPrimary: true,
      cell: (row) => <Link href={`/industry-templates/${row.industryTemplateId}`}>{row.name}</Link>,
    },
    { columnKey: "key", header: labels.key, cell: (row) => row.industryTemplateKey },
    { columnKey: "kinds", header: labels.kinds, cell: (row) => row.kinds },
    { columnKey: "modules", header: labels.modules, cell: (row) => row.moduleCountLabel },
    { columnKey: "version", header: labels.version, cell: (row) => row.versionLabel },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => <StatusPill tone={row.statusTone} label={row.statusLabel} />,
    },
  ];
}

/** The industry list: a table from md, cards below; a row opens the template. */
export function IndustryTemplateList({
  rows,
  labels,
}: {
  rows: IndustryTemplateRowView[];
  labels: IndustryTemplateListLabels;
}): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.industryTemplateId}
      onRowSelect={(row) => router.push(`/industry-templates/${row.industryTemplateId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
