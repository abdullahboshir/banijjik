import type { ReactElement } from "react";
import { TransferPage } from "../../../../../src/stock/transfer-page";

export default async function TransfersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <TransferPage orgSlug={orgSlug} searchParams={query} />;
}
