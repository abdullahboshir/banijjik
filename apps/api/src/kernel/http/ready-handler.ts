import type { RequestHandler } from "express";
import { ERROR_CODE, type ApiErrorEnvelope } from "@banijjik/contracts";
import { getLogger } from "../logger/index.js";
import { sendData } from "./envelope.js";
import { readRequestId } from "./request-id.middleware.js";

/** What a dependency check says about the instance. `details` names optional parts that are degraded. */
export interface Readiness {
  readonly isReady: boolean;
  readonly details?: Readonly<Record<string, string>>;
}

/**
 * GET /ready: 200 when the instance can serve, 503 otherwise. A degraded optional part (Redis in
 * the API role) is reported in `details` and does not make the instance not ready. It writes the
 * 503 body itself because the error handler maps INTERNAL to 500, and a probe needs to tell
 * "not ready" apart.
 */
export function createReadyHandler(checkReadiness: () => Promise<Readiness>): RequestHandler {
  return async (_request, response) => {
    const readiness = await checkReadiness();
    if (readiness.isReady) {
      sendData(response, {
        status: "ready",
        ...(readiness.details === undefined ? {} : { details: readiness.details }),
      });
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
