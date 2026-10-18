import type { ReactElement } from "react";
import { OfferingListPage } from "../../../../src/catalog/offering-list-page";

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <OfferingListPage orgSlug={orgSlug} searchParams={query} />;
}
