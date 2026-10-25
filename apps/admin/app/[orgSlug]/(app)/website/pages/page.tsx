import type { ReactElement } from "react";
import { SitePagesPage } from "../../../../../src/website/site-pages-page";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <SitePagesPage orgSlug={orgSlug} />;
}
