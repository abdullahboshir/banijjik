import type { ReactElement } from "react";
import { AdjustmentsPage } from "../../../../../src/stock/adjustments-page";

export default async function AdjustmentsPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <AdjustmentsPage orgSlug={orgSlug} searchParams={query} />;
}
