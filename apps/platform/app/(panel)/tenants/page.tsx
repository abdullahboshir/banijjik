import type { ReactElement } from "react";
import { TenantsPage } from "../../../src/tenants/tenants-page";

export default async function TenantsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  return <TenantsPage searchParams={await searchParams} />;
}
