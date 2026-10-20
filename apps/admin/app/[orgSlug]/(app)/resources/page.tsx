import type { ReactElement } from "react";
import { ResourceListPage } from "../../../../src/resources/resource-list-page";

export default async function ResourcesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ResourceListPage orgSlug={orgSlug} searchParams={query} />;
}
