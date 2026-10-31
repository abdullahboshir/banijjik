import type { RequestHandler } from "express";

const PRIVATE_NO_STORE = "private, no-store";

export function storefrontCacheGuard(): RequestHandler {
  return (request, response, next) => {
    response.setHeader("Cache-Control", PRIVATE_NO_STORE);
    const hasCreds = Boolean(request.headers.cookie || request.headers.authorization);
    const originalSet = response.setHeader.bind(response);
    response.setHeader = (name, value) => {
      const lower = name.toLowerCase();
      if (lower === "cache-control" && (hasCreds || response.getHeader("set-cookie"))) {
        return originalSet("Cache-Control", PRIVATE_NO_STORE);
      }
      if (lower === "set-cookie") originalSet("Cache-Control", PRIVATE_NO_STORE);
      return originalSet(name, value);
    };
    next();
  };
}
