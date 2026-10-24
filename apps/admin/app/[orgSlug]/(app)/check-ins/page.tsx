import { CheckInsPage } from "../../../../src/enrollment/check-ins-page";
import type { LocationResponse } from "@banijjik/contracts";
import { fetchBusinessResource } from "../../../../src/lib/api/server-resource";
import { requireOrgAccess } from "../../../../src/shell/org-access";
export default async function Page({ params }: { params: Promise<{ orgSlug: string }> }) {
  const access = await requireOrgAccess((await params).orgSlug);
  const locations = await fetchBusinessResource<LocationResponse[]>(
    `/orgs/${access.organization.organizationId}/locations?status=ACTIVE&limit=1`,
  );
  return (
    <CheckInsPage
      organizationId={access.organization.organizationId}
      locationId={locations.data[0]?.locationId ?? ""}
    />
  );
}
