import type { ReactElement } from "react";
import { DomainsPage } from "../../../../../src/website/domains-page";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <DomainsPage orgSlug={orgSlug} />;
}
