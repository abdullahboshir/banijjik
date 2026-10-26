import type { ReactElement } from "react";
import { ReportHomePage } from "../../../src/report/report-home-page";

/** The business home: the greeting, then the "today" cards the API allows the caller to see (card 3.10). */
export default async function OrganizationHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <ReportHomePage orgSlug={orgSlug} searchParams={query} />;
}
