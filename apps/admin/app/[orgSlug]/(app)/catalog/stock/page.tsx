import type { ReactElement } from "react";
import { StockListPage } from "../../../../../src/stock/stock-list-page";

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <StockListPage orgSlug={orgSlug} searchParams={query} />;
}
