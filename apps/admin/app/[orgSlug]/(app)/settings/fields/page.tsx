import type { ReactElement } from "react";
import { FieldsPage } from "../../../../../src/fields/fields-page";

export default async function SettingsFieldsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <FieldsPage orgSlug={orgSlug} searchParams={query} />;
}
