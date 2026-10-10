import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError } from "../../../../kernel/http/index.js";

export interface TenantCaller {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

/** The organization and user of a request that went through the tenant pipeline. */
export function readTenantCaller(): TenantCaller {
  const { organizationId } = getRequestContext();
  if (organizationId === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
  }
  return {
    organizationId: asId<OrganizationId>(organizationId),
    actorUserId: requireCurrentUserId(),
  };
}
