import type { ReactElement } from "react";
import { TenantDetailPage } from "../../../../src/tenants/tenant-detail-page";

export default async function TenantDetailRoute({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}): Promise<ReactElement> {
  const { organizationId } = await params;
  return <TenantDetailPage organizationId={organizationId} />;
}
