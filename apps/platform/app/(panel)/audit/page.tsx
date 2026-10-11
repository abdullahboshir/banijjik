import type { ReactElement } from "react";
import { AuditPage } from "../../../src/audit/audit-page";

export default async function AuditRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  return <AuditPage searchParams={await searchParams} />;
}
