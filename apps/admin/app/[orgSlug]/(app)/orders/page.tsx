import type { ReactElement } from "react";
import { OrdersListPage } from "../../../../src/sales/orders-list-page";

export default async function OrdersRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <OrdersListPage orgSlug={orgSlug} searchParams={query} />;
}
