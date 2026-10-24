import type { ReactElement } from "react";
import { CheckInsPage } from "../../../../src/enrollment/check-ins-page";

export default async function CheckInsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  return <CheckInsPage orgSlug={(await params).orgSlug} />;
}
