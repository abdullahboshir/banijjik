import { ERROR_CODE, ERROR_HTTP_STATUS, type ErrorCode } from "@banijjik/contracts";
import { UPSTREAM_TIMEOUT_MS } from "../config/storefront-config";
import { headersForBrowser, headersForUpstream } from "./forward-headers";
import { isForeignOriginWrite } from "./origin-guard";

/** The API could not be reached (or timed out): the browser sees a gateway error, not a stack trace. */
const BAD_GATEWAY_STATUS = 502;

/** What the browser may reach: the upstream path and the rule that allows it. */
export interface ProxyRoute {
  /** Upstream prefix, such as `/api/v1/storefront`; the segments are appended to it. */
  readonly apiPrefix: string;
  readonly segments: readonly string[];
  readonly isAllowed: boolean;
}

export interface ProxyContext {
  readonly apiOrigin: string;
  readonly method: string;
  readonly search: string;
  readonly origin: string | null;
  readonly host: string | null;
  readonly headers: Headers;
  readonly body: ArrayBuffer | undefined;
}

/** Error body in the API's shape (14-API section 2), so the browser reads one format from both. */
export function proxyError(code: ErrorCode, messageKey: string, status?: number): Response {
  const httpStatus = status ?? ERROR_HTTP_STATUS[code];
  return Response.json({ error: { code, messageKey } }, { status: httpStatus });
}

function upstreamUrl(context: ProxyContext, route: ProxyRoute): string {
  return `${context.apiOrigin}${route.apiPrefix}/${route.segments.join("/")}${context.search}`;
}

async function sendUpstream(context: ProxyContext, route: ProxyRoute): Promise<Response> {
  return fetch(upstreamUrl(context, route), {
    method: context.method,
    headers: headersForUpstream(context.headers),
    ...(context.body === undefined ? {} : { body: context.body }),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

/**
 * Forwards one browser request to the API. Order matters: a foreign write is refused before anything
 * else, and a path that names another business is refused before it leaves the server (ADR-119).
 */
export async function forwardToApi(context: ProxyContext, route: ProxyRoute): Promise<Response> {
  if (isForeignOriginWrite(context)) {
    return proxyError(ERROR_CODE.FORBIDDEN, "errors.forbidden");
  }
  if (!route.isAllowed) {
    return proxyError(ERROR_CODE.NOT_FOUND, "errors.storefront_not_available");
  }
  const upstream = await sendUpstream(context, route).catch(() => undefined);
  if (upstream === undefined) {
    return proxyError(ERROR_CODE.INTERNAL, "errors.internal", BAD_GATEWAY_STATUS);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: headersForBrowser(upstream),
  });
}
