import type { ReactElement } from "react";
import { DirectoryQueuePage } from "../../../../../src/directory/queue-page";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <DirectoryQueuePage orgSlug={orgSlug} />;
}
