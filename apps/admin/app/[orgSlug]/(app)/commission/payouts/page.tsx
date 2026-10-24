import type { ReactElement } from "react";
import { CommissionPayoutsPage } from "../../../../../src/commission/commission-payouts-page";

export default async function CommissionPayoutsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <CommissionPayoutsPage orgSlug={orgSlug} searchParams={query} />;
}
