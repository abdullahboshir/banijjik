import "server-only";
import { ERROR_HTTP_STATUS } from "@banijjik/contracts";
import { ApiError, type ApiResult } from "@banijjik/web-client";
import { notFound } from "next/navigation";
import { requireOperatorSession } from "../auth/session-data";
import { serverApiFetch } from "./platform-server-api";

/**
 * Reads one resource of the platform API on the server. No session goes to the renewal page, and a 404 is the
 * not-found page. Other failures, a 403 included, reach the error page: screens check permissions first.
 */
export function fetchPlatformResource<Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
): Promise<ApiResult<Data, Meta>> {
  return requireOperatorSession(async () => {
    try {
      return await serverApiFetch<Data, Meta>(path);
    } catch (error) {
      if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.NOT_FOUND) notFound();
      throw error;
    }
  });
}
