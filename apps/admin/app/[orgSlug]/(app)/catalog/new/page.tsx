import type { ReactElement } from "react";
import { OfferingNewPage } from "../../../../../src/catalog/offering-new-page";

export default async function NewOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <OfferingNewPage orgSlug={orgSlug} searchParams={query} />;
}
