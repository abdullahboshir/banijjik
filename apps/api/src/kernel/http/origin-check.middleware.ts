import { ERROR_CODE } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import { AppError } from "./app-error.js";

const UNSAFE_METHODS: ReadonlySet<string> = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Second line of defence against cross-site request forgery next to SameSite=Lax cookies: an
 * unsafe request that names an Origin must come from a configured one. Requests without an Origin
 * (curl, server to server) are not browser form posts, so they pass. Mount it after CORS.
 */
export function createOriginCheck(allowedOrigins: readonly string[]): RequestHandler {
  const allowed: ReadonlySet<string> = new Set(allowedOrigins);
  return (request, _response, next) => {
    const origin = request.get("origin");
    const isUnsafe = UNSAFE_METHODS.has(request.method);
    if (origin !== undefined && isUnsafe && !allowed.has(origin)) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.origin_not_allowed" });
    }
    next();
  };
}
