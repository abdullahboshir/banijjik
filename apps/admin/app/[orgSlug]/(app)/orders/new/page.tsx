import type { ReactElement } from "react";
import { NewOrderPage } from "../../../../../src/sales/new-order-page";

export default async function NewOrderRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <NewOrderPage orgSlug={orgSlug} />;
}
