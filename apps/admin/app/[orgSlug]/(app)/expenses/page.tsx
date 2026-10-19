import type { ReactElement } from "react";
import { ExpenseListPage } from "../../../../src/expenses/expense-list-page";

export default async function ExpensesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ExpenseListPage orgSlug={orgSlug} searchParams={query} />;
}
