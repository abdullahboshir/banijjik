"use client";

import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface DataListColumn<Row> {
  columnKey: string;
  header: string;
  cell: (row: Row) => ReactNode;
  isPrimary?: boolean;
  align?: "start" | "end";
}

export interface DataListProps<Row> {
  columns: DataListColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowSelect?: (row: Row) => void;
  emptyState: ReactNode;
}

type RowsProps<Row> = Omit<DataListProps<Row>, "emptyState">;

const ALIGN_CLASS = { start: "text-start", end: "text-end" } as const;

function alignClass(column: { align?: "start" | "end" | undefined }): string {
  return ALIGN_CLASS[column.align ?? "start"];
}

function selectOnKey(event: KeyboardEvent, select: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  select();
}

function DataTable<Row>({ columns, rows, rowKey, onRowSelect }: RowsProps<Row>): ReactElement {
  return (
    <table className="hidden w-full border-collapse text-small md:table">
      <thead className="bg-subtle text-secondary">
        <tr>
          {columns.map((column) => (
            <th key={column.columnKey} scope="col" className={cn("px-3 py-2", alignClass(column))}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            tabIndex={onRowSelect ? 0 : undefined}
            onClick={onRowSelect ? () => onRowSelect(row) : undefined}
            onKeyDown={
              onRowSelect ? (event) => selectOnKey(event, () => onRowSelect(row)) : undefined
            }
            className={cn(
              "border-b border-default",
              onRowSelect && "cursor-pointer hover:bg-subtle",
            )}
          >
            {columns.map((column) => (
              <td key={column.columnKey} className={cn("px-3 py-3", alignClass(column))}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CardBody<Row>({
  columns,
  row,
}: {
  columns: DataListColumn<Row>[];
  row: Row;
}): ReactElement {
  const [titleColumn, ...detailColumns] = columns;
  return (
    <div className="flex flex-col gap-1">
      {titleColumn ? (
        <div className="text-body font-semibold text-primary">{titleColumn.cell(row)}</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-secondary">
        {detailColumns.map((column) => (
          <span key={column.columnKey}>{column.cell(row)}</span>
        ))}
      </div>
    </div>
  );
}

function DataCards<Row>({ columns, rows, rowKey, onRowSelect }: RowsProps<Row>): ReactElement {
  const primaryColumns = columns.filter((column) => column.isPrimary);
  const cardColumns = primaryColumns.length > 0 ? primaryColumns : columns.slice(0, 1);
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <li key={rowKey(row)} className="rounded-md border border-default bg-surface shadow-sm">
          {onRowSelect ? (
            <button
              type="button"
              onClick={() => onRowSelect(row)}
              className="min-h-11 w-full p-4 text-start"
            >
              <CardBody columns={cardColumns} row={row} />
            </button>
          ) : (
            <div className="p-4">
              <CardBody columns={cardColumns} row={row} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Table from the md breakpoint, cards below. Both are rendered and CSS picks one, so SSR matches the client. */
export function DataList<Row>(props: DataListProps<Row>): ReactElement {
  if (props.rows.length === 0) return <>{props.emptyState}</>;
  return (
    <div>
      <DataTable {...props} />
      <DataCards {...props} />
    </div>
  );
}
