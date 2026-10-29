import { STOREFRONT_PORT } from "./storefront-stack";

const LOOPBACK_ORIGIN = `http://127.0.0.1:${STOREFRONT_PORT}`;

/**
 * Node on Windows does not resolve `*.localhost` the way Chrome does. Talk to loopback and send the
 * Host the proxy uses for C1 resolution (same as `proxy.test.ts`).
 */
export function fetchStorefront(
  path: string,
  options: { hostname: string; cookieHeader?: string },
): Promise<Response> {
  return fetch(`${LOOPBACK_ORIGIN}${path}`, {
    headers: {
      host: `${options.hostname}:${STOREFRONT_PORT}`,
      ...(options.cookieHeader === undefined ? {} : { Cookie: options.cookieHeader }),
    },
  });
}
