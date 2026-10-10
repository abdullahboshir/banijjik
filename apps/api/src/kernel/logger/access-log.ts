import type { ServerResponse } from "node:http";
import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { REQUEST_ID_HEADER } from "../http/request-id.middleware.js";

interface SerializedRequest {
  readonly method?: string;
  readonly url?: string;
  readonly headers?: Readonly<Record<string, unknown>>;
}

/** Headers carry cookies and tokens, so only the user agent is kept. */
function serializeRequest(serialized: SerializedRequest): object {
  return {
    method: serialized.method,
    url: serialized.url,
    userAgent: serialized.headers?.["user-agent"],
  };
}

/** The response header is read because the finish event may fire outside the request's async context. */
function readRequestId(_request: unknown, response: ServerResponse): string {
  return String(response.getHeader(REQUEST_ID_HEADER) ?? "");
}

/** One access line per response. Mount it after requestIdMiddleware so the request id is known. */
export function createAccessLog(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: readRequestId,
    customProps: (request, response) => ({ requestId: readRequestId(request, response) }),
    serializers: { req: serializeRequest },
  });
}
