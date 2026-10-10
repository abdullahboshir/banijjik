import {
  platformPermissionsOf,
  type PlatformPermissionKey,
  type PlatformRole,
} from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { getRequestContext } from "../context/index.js";
import { forbidden, unauthenticated } from "../http/index.js";

export type PlatformPermissionMiddlewareFactory = (key: PlatformPermissionKey) => RequestHandler;

/** The platform roles of the signed-in operator, put into the context by authenticatePlatform(). */
export function requirePlatformRoles(): readonly PlatformRole[] {
  const { platformRoles } = getRequestContext();
  if (platformRoles === undefined) throw unauthenticated();
  return platformRoles;
}

/**
 * The per-route guard of the platform API: `403 FORBIDDEN` unless one of the operator's roles
 * grants the key (ADR-093). The permissions come from the roles alone, never from a request.
 */
export function platformPermission(key: PlatformPermissionKey): RequestHandler {
  return (_request, _response, next) => {
    if (!platformPermissionsOf(requirePlatformRoles()).has(key)) throw forbidden();
    next();
  };
}
