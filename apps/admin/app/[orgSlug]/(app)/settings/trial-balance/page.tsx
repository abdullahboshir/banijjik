import type { ReactElement } from "react";
import { TrialBalancePage } from "../../../../../src/trial-balance/trial-balance-page";

export default async function TrialBalanceRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <TrialBalancePage orgSlug={orgSlug} searchParams={query} />;
}
