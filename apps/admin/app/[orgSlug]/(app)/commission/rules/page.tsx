import type { ReactElement } from "react";
import { CommissionRulesPage } from "../../../../../src/commission/commission-rules-page";

export default async function CommissionRulesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <CommissionRulesPage orgSlug={orgSlug} searchParams={query} />;
}
