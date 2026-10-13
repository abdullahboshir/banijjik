import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { requireCurrentUserId } from "../auth/index.js";
import { getRequestContext } from "../context/index.js";
import { AppError } from "../http/index.js";

export interface TenantIdentity {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

/** The organization and user of a request that went through the tenant pipeline. */
export function readTenantIdentity(): TenantIdentity {
  const { organizationId } = getRequestContext();
  if (organizationId === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
  }
  return {
    organizationId: asId<OrganizationId>(organizationId),
    actorUserId: requireCurrentUserId(),
  };
}
