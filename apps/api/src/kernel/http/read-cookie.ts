import { parseCookie } from "cookie";
import type { Request } from "express";

/** One cookie of the request, or undefined. Express does not parse cookies by itself. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) return undefined;
  return parseCookie(header)[name];
}
