import type { ReactElement } from "react";
import { CreditPurchasesPage } from "../../../../../src/credit/credit-purchases-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <CreditPurchasesPage orgSlug={orgSlug} searchParams={query} />;
}
