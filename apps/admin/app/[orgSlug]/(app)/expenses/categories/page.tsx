import type { ReactElement } from "react";
import { ExpenseCategoriesPage } from "../../../../../src/expenses/categories-page";

export default async function ExpenseCategoriesRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <ExpenseCategoriesPage orgSlug={orgSlug} />;
}
