import type { RequestHandler } from "express";
import { ERROR_CODE, type ApiErrorEnvelope } from "@banijjik/contracts";
import { getLogger } from "../logger/index.js";
import { sendData } from "./envelope.js";
import { readRequestId } from "./request-id.middleware.js";

/**
 * GET /ready: 200 when the dependencies answer, 503 otherwise. It writes the 503 body itself
 * because the error handler maps INTERNAL to 500, and a probe needs to tell "not ready" apart.
 */
export function createReadyHandler(isReady: () => Promise<boolean>): RequestHandler {
  return async (_request, response) => {
    if (await isReady()) {
      sendData(response, { status: "ready" });
      return;
    }
    getLogger().warn({ event: "ready.failed" }, "dependencies are not ready");
    const body: ApiErrorEnvelope = {
      error: {
        code: ERROR_CODE.INTERNAL,
        messageKey: "errors.not_ready",
        requestId: readRequestId(response),
      },
    };
    response.status(503).json(body);
  };
}
