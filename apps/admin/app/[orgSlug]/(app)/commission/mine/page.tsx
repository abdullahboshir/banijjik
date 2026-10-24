import type { ReactElement } from "react";
import { CommissionMinePage } from "../../../../../src/commission/commission-mine-page";

export default async function CommissionMineRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <CommissionMinePage orgSlug={orgSlug} searchParams={query} />;
}
