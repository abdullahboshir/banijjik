import { ERROR_CODE } from "@banijjik/contracts";
import { findRequestContext, getSystemReason } from "../context/index.js";
import { AppError } from "../http/app-error.js";

export type AllowedLocations = readonly string[] | "ALL";

/** What the tenant plugin enforces for one operation: nothing (system access) or one organization. */
export type TenantScope =
  { readonly kind: "SYSTEM" } | { readonly kind: "ORGANIZATION"; readonly organizationId: string };

export function resolveTenantScope(): TenantScope {
  if (getSystemReason() !== undefined) return { kind: "SYSTEM" };
  const organizationId = findRequestContext()?.organizationId;
  if (organizationId === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
  }
  return { kind: "ORGANIZATION", organizationId };
}

/** Undefined means "no location limit": system access, or a caller assigned to every location. */
export function resolveAllowedLocations(): readonly string[] | undefined {
  if (getSystemReason() !== undefined) return undefined;
  const allowed = findRequestContext()?.allowedLocationIds;
  if (allowed === undefined) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.missing_location_context",
    });
  }
  return allowed === "ALL" ? undefined : allowed;
}

export function crossOrganizationAccess(): AppError {
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.cross_organization_access",
  });
}

export function unsafeTenantOperation(messageKey: string): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey });
}
