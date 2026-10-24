import type { ReactElement } from "react";
import { CommissionEntriesPage } from "../../../../../src/commission/commission-entries-page";

export default async function CommissionEntriesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <CommissionEntriesPage orgSlug={orgSlug} searchParams={query} />;
}
