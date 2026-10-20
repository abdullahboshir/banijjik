import type { ReactElement } from "react";
import { DirectoryListingsPage } from "../../../../../src/directory/listings-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <DirectoryListingsPage orgSlug={orgSlug} searchParams={query} />;
}
