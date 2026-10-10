import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { readRequestId } from "../http/request-id.middleware.js";
import { maskSecretPathSegments } from "./mask-secret-path.js";

interface SerializedRequest {
  readonly method?: string;
  readonly url?: string;
  readonly headers?: Readonly<Record<string, unknown>>;
}

interface SerializedResponse {
  readonly statusCode?: number;
}

/**
 * The query string is dropped because it can carry tokens and emails (review finding B1); a secret
 * in the path, the invitation token, is masked.
 */
function stripQueryString(url: string | undefined): string | undefined {
  const path = url?.split("?")[0];
  return path === undefined ? undefined : maskSecretPathSegments(path);
}

/** Headers carry cookies and tokens, so only the user agent is kept. */
function serializeRequest(serialized: SerializedRequest): object {
  return {
    method: serialized.method,
    url: stripQueryString(serialized.url),
    userAgent: serialized.headers?.["user-agent"],
  };
}

/** Response headers carry Set-Cookie (session and refresh tokens), so only the status is kept. */
function serializeResponse(serialized: SerializedResponse): object {
  return { statusCode: serialized.statusCode };
}

/** One access line per response. Mount it after requestIdMiddleware so the request id is known. */
export function createAccessLog(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    // The response header is read because the finish event may fire outside the request's async context.
    genReqId: (_request, response) => readRequestId(response),
    customProps: (_request, response) => ({ requestId: readRequestId(response) }),
    serializers: { req: serializeRequest, res: serializeResponse },
  });
}
