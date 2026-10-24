import type { ReactElement } from "react";
import { EnrollmentsPage } from "../../../../src/enrollment/enrollments-page";

export default async function EnrollmentsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <EnrollmentsPage orgSlug={orgSlug} searchParams={query} />;
}
