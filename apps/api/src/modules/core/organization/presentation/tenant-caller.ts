import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError } from "../../../../kernel/http/index.js";

export interface TenantCaller {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  /** The locations the request may use after the permission guard narrowed them; "ALL" for every one. */
  readonly allowedLocationIds: readonly string[] | "ALL";
}

/** The organization, user and locations of a request that went through the tenant pipeline. */
export function readTenantCaller(): TenantCaller {
  const { organizationId, allowedLocationIds } = getRequestContext();
  if (organizationId === undefined || allowedLocationIds === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
  }
  return {
    organizationId: asId<OrganizationId>(organizationId),
    actorUserId: requireCurrentUserId(),
    allowedLocationIds,
  };
}
