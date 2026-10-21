import type { ReactElement } from "react";
import { DirectoryQueuePage } from "../../../../../src/directory/queue-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <DirectoryQueuePage orgSlug={orgSlug} searchParams={query} />;
}
