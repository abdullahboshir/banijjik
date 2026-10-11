import type { RequestHandler } from "express";
import { getRequestContext } from "../context/index.js";
import { forbidden } from "../http/app-error.js";

/**
 * For records that belong to the whole organization (locations, roles). Mount it after
 * `permission(key)`: that guard narrowed the request's locations, so anything but "ALL" means the
 * caller holds the permission at only some locations, or is assigned to only some. Answers 403.
 */
export function requireAllLocations(): RequestHandler {
  return (_request, _response, next) => {
    if (getRequestContext().allowedLocationIds !== "ALL") throw forbidden();
    next();
  };
}
