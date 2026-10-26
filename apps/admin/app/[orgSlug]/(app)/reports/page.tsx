import type { ReactElement } from "react";
import { ReportDailyPage } from "../../../../src/report/report-daily-page";

export default async function ReportsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ReportDailyPage orgSlug={orgSlug} searchParams={query} />;
}
