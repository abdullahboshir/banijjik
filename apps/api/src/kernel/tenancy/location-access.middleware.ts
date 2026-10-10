import { ERROR_CODE } from "@banijjik/contracts";
import { uuidV7Schema } from "@banijjik/validation";
import type { RequestHandler } from "express";
import { getRequestContext } from "../context/index.js";
import { AppError, validationFailed } from "../http/app-error.js";

const LOCATION_QUERY_KEY = "location";

/**
 * Checks the page filter `?location=<id>` against the caller's locations. A location outside the
 * list answers 403 LOCATION_FORBIDDEN; a malformed id answers 400. Mounted once, in routes/v1.ts,
 * right after tenantContext(). Use cases still check that the location exists and is ACTIVE.
 */
export function locationAccess(): RequestHandler {
  return (request, _response, next) => {
    const requested = request.query[LOCATION_QUERY_KEY];
    if (requested === undefined) {
      next();
      return;
    }
    const parsed = uuidV7Schema.safeParse(requested);
    if (!parsed.success) {
      throw validationFailed([
        { path: LOCATION_QUERY_KEY, messageKey: "validation.invalid_format" },
      ]);
    }
    const { allowedLocationIds } = getRequestContext();
    if (allowedLocationIds !== "ALL" && !allowedLocationIds?.includes(parsed.data)) {
      throw new AppError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
    }
    next();
  };
}
