import type { ReactElement } from "react";
import { ReportsQueuePage } from "../../../../../src/directory/reports-queue-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ReportsQueuePage orgSlug={orgSlug} searchParams={query} />;
}
