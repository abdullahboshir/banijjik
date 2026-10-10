import type { PermissionKey } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import { forbidden } from "../http/app-error.js";
import { narrowLocations } from "./narrow-locations.js";
import type { PermissionGate } from "./permission-gate.js";

const LOCATION_QUERY_KEY = "location";

export type PermissionMiddlewareFactory = (permissionKey: PermissionKey) => RequestHandler;

function isEmpty(locations: readonly string[] | "ALL"): boolean {
  return locations !== "ALL" && locations.length === 0;
}

function assertRequestedLocationIsGranted(
  requested: unknown,
  narrowed: readonly string[] | "ALL",
): void {
  if (typeof requested !== "string" || narrowed === "ALL") return;
  if (!narrowed.includes(requested)) throw forbidden();
}

/**
 * Builds the `permission(key)` route guard once, in routes/v1.ts (ADR-088). It answers 403
 * FORBIDDEN when the caller holds the permission nowhere, otherwise it continues in a context
 * whose `allowedLocationIds` is narrowed to the locations where the permission is granted. The
 * location plugin then refuses a write outside them without any per-route code. A `?location=`
 * outside the narrowed set is also 403: the caller may be there, but not with this permission.
 */
export function createPermissionMiddleware(gate: PermissionGate): PermissionMiddlewareFactory {
  return (permissionKey) => async (request, _response, next) => {
    const granted = await gate.locationsWith(permissionKey);
    if (isEmpty(granted)) throw forbidden();
    const context = getRequestContext();
    const narrowed = narrowLocations(context.allowedLocationIds, granted);
    if (isEmpty(narrowed)) throw forbidden();
    assertRequestedLocationIsGranted(request.query[LOCATION_QUERY_KEY], narrowed);
    runWithRequestContext({ ...context, allowedLocationIds: narrowed }, () => next());
  };
}
