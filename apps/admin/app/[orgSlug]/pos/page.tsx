import type { ReactElement } from "react";
import { PosPage } from "../../../src/pos/pos-page";

export default async function PosRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <PosPage orgSlug={orgSlug} />;
}
