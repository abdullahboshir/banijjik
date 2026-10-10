import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataList, type DataListColumn } from "./data-list.js";

interface OrderRow {
  orderId: string;
  number: string;
  contactName: string;
  total: string;
}

const rows: OrderRow[] = [
  { orderId: "o1", number: "ORD-000045", contactName: "রহিম উদ্দিন আহমেদ", total: "৳ 1,250" },
  { orderId: "o2", number: "ORD-000046", contactName: "করিমা বেগম", total: "৳ 480" },
];

const columns: DataListColumn<OrderRow>[] = [
  { columnKey: "number", header: "অর্ডার নম্বর", cell: (row) => row.number, isPrimary: true },
  { columnKey: "contact", header: "গ্রাহকের নাম", cell: (row) => row.contactName },
  { columnKey: "total", header: "সর্বমোট পরিমাণ", cell: (row) => row.total, isPrimary: true },
];

function renderList(onRowSelect?: (row: OrderRow) => void) {
  return render(
    <DataList
      columns={columns}
      rows={rows}
      rowKey={(row) => row.orderId}
      emptyState={<p>এখনো কোনো অর্ডার নেই</p>}
      {...(onRowSelect ? { onRowSelect } : {})}
    />,
  );
}

describe("DataList", () => {
  it("renders a table with every column header and every cell", () => {
    renderList();
    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("columnheader", { hidden: true })).toHaveLength(3);
    expect(within(table).getByText("করিমা বেগম")).not.toBeNull();
  });

  it("renders cards that show only the primary columns", () => {
    renderList();
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    const firstCard = within(cards[0] as HTMLElement);
    expect(firstCard.getByText("ORD-000045")).not.toBeNull();
    expect(firstCard.getByText("৳ 1,250")).not.toBeNull();
    expect(firstCard.queryByText("রহিম উদ্দিন আহমেদ")).toBeNull();
  });

  it("shows the empty state instead of an empty table when there are no rows", () => {
    render(
      <DataList
        columns={columns}
        rows={[]}
        rowKey={(row: OrderRow) => row.orderId}
        emptyState={<p>এখনো কোনো অর্ডার নেই</p>}
      />,
    );
    expect(screen.getByText("এখনো কোনো অর্ডার নেই")).not.toBeNull();
    expect(screen.queryByRole("table", { hidden: true })).toBeNull();
  });

  it("reports the selected row when a card is tapped", async () => {
    const onRowSelect = vi.fn();
    renderList(onRowSelect);
    const cards = screen.getAllByRole("listitem");
    await userEvent.click(within(cards[1] as HTMLElement).getByRole("button"));
    expect(onRowSelect).toHaveBeenCalledWith(rows[1]);
  });
});
