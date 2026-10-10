import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";

export function pretendToBeAnOrganization(organizationId: string): Promise<number> {
  return runInOrganizationContext(organizationId, async () => 1);
}
