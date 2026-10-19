import type { ReactElement } from "react";
import { ExpenseDetailPage } from "../../../../../src/expenses/expense-detail-page";

export default async function ExpenseDetailRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; expenseId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, expenseId } = await params;
  return <ExpenseDetailPage orgSlug={orgSlug} expenseId={expenseId} />;
}
