import "server-only";
import { ERROR_HTTP_STATUS } from "@banijjik/contracts";
import { notFound } from "next/navigation";
import { requireSession } from "../../auth/session-data";
import { ApiError } from "./api-error";
import { serverApiFetch } from "./server-api-fetch";
import type { ApiResult } from "./parse-api-response";

/**
 * Reads one resource of a business on the server. No session goes to the renewal page, and a 404 (also the
 * answer for a resource of another business, ADR-080) is the not-found page. Other failures reach the error page.
 */
export function fetchBusinessResource<Data, Meta = Readonly<Record<string, unknown>>>(
  path: string,
): Promise<ApiResult<Data, Meta>> {
  return requireSession(async () => {
    try {
      return await serverApiFetch<Data, Meta>(path);
    } catch (error) {
      if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.NOT_FOUND) notFound();
      throw error;
    }
  });
}

/** Like `fetchBusinessResource`, but a refusal for lack of permission gives `undefined` instead of an error. */
export async function fetchBusinessResourceIfAllowed<Data>(
  path: string,
): Promise<Data | undefined> {
  try {
    return (await fetchBusinessResource<Data>(path)).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.FORBIDDEN) return undefined;
    throw error;
  }
}
