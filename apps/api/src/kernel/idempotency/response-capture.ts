import { ERROR_CODE } from "@banijjik/contracts";
import type { Response } from "express";
import { AppError } from "../http/app-error.js";

export interface CapturedResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface CaptureHandlers {
  /** Runs before the client gets the answer, so a retry right after it already finds the result. */
  readonly settle: (captured: CapturedResponse) => Promise<void>;
  /** A failure to write the answer, handed to the error pipeline. */
  readonly fail: (error: unknown) => void;
  /** A failure of `settle` itself. The answer is still sent: the work is already done. */
  readonly report: (error: unknown) => void;
}

type RawWriter = (...args: unknown[]) => unknown;

function unsupportedResponse(): AppError {
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.idempotency_unsupported_response",
  });
}

/**
 * A handler of an idempotent route must answer with `response.json` (which `sendData` and the
 * error handler do). Any other way to write the response cannot be stored for a replay, so it
 * is refused instead of silently going unrecorded.
 */
function refuseDirectWrites(response: Response, isForwarding: () => boolean): void {
  for (const method of ["send", "end"] as const) {
    // Safe: send and end are overloaded; both are only forwarded with the arguments they received.
    const original = response[method].bind(response) as RawWriter;
    const guarded: RawWriter = (...args) => {
      if (!isForwarding()) throw unsupportedResponse();
      return original(...args);
    };
    // Safe: same reason; the guarded function behaves like the original once forwarding.
    response[method] = guarded as never;
  }
}

/**
 * Holds back the handler's JSON answer until `settle` has stored it (success) or released the key
 * (failure), then sends it unchanged. Waiting is what makes "replay right after the response" safe.
 */
export function captureJsonResponse(response: Response, handlers: CaptureHandlers): void {
  const sendJson = response.json.bind(response);
  let isForwarding = false;
  let isSettled = false;
  const forward = (body: unknown): void => {
    isForwarding = true;
    try {
      sendJson(body);
    } finally {
      isForwarding = false;
    }
  };
  const settleThenForward = async (captured: CapturedResponse): Promise<void> => {
    try {
      await handlers.settle(captured);
    } catch (error) {
      handlers.report(error);
    }
    try {
      forward(captured.body);
    } catch (error) {
      handlers.fail(error);
    }
  };
  refuseDirectWrites(response, () => isForwarding);
  response.json = (body?: unknown): Response => {
    if (isSettled) {
      forward(body);
      return response;
    }
    isSettled = true;
    void settleThenForward({ status: response.statusCode, body });
    return response;
  };
}
