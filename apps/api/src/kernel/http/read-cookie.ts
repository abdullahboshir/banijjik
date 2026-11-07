import * as cookie from "cookie";
import type { Request } from "express";

/** One cookie of the request, or undefined. Express does not parse cookies by itself. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) return undefined;
  const parseFn =
    (cookie as unknown as { parse?: (h: string) => Record<string, string> }).parse ??
    (cookie as unknown as { parseCookie?: (h: string) => Record<string, string> }).parseCookie;
  return parseFn ? parseFn(header)[name] : undefined;
}
