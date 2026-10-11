import type { ReactElement } from "react";
import { StaffListPage } from "../../../../../src/staff/staff-list-page";

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <StaffListPage orgSlug={orgSlug} searchParams={query} />;
}
