import type { RequestHandler } from "express";
import { newId } from "@banijjik/ids";
import { runWithRequestContext } from "../context/index.js";

export const REQUEST_ID_HEADER = "X-Request-Id";
const MAX_REQUEST_ID_LENGTH = 36;
const UUID_ANY_VERSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A client-supplied id is trusted only when it is a UUID, so log lines cannot be forged or flooded. */
function readIncomingRequestId(header: string | undefined): string | undefined {
  if (header === undefined || header.length > MAX_REQUEST_ID_LENGTH) return undefined;
  return UUID_ANY_VERSION.test(header) ? header : undefined;
}

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const requestId = readIncomingRequestId(request.get(REQUEST_ID_HEADER)) ?? newId();
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.locals["requestId"] = requestId;
  runWithRequestContext({ requestId }, next);
};
