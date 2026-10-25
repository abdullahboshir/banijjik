import type { ReactElement } from "react";
import { ReturnsListPage } from "../../../../src/sales/returns-list-page";

export default async function ReturnsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ReturnsListPage orgSlug={orgSlug} searchParams={query} />;
}
