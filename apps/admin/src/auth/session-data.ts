import "server-only";
import {
  ERROR_HTTP_STATUS,
  type MeResponse,
  type MyOrganizationSummary,
} from "@banijjik/contracts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "../lib/api/api-error";
import { serverApiFetch } from "../lib/api/server-api-fetch";
import { REQUEST_PATH_HEADER } from "./request-path";
import { buildSessionRenewalPath, safeNextPath } from "./safe-next-path";

export interface SessionData {
  me: MeResponse;
  organizations: MyOrganizationSummary[];
}

async function redirectToSessionRenewal(): Promise<never> {
  const requestedPath = (await headers()).get(REQUEST_PATH_HEADER);
  return redirect(buildSessionRenewalPath(safeNextPath(requestedPath)));
}

/**
 * Runs a server-side load; if the API says the visitor has no valid session, the visitor is sent to /session
 * (one silent renewal in the browser) and from there to sign-in, coming back to the page they asked for.
 */
export async function requireSession<Result>(load: () => Promise<Result>): Promise<Result> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.UNAUTHENTICATED)
      return redirectToSessionRenewal();
    throw error;
  }
}

/** The signed-in person and their businesses, loaded in parallel. */
export function loadSessionData(): Promise<SessionData> {
  return requireSession(async () => {
    const [me, organizations] = await Promise.all([
      serverApiFetch<MeResponse>("/me"),
      serverApiFetch<MyOrganizationSummary[]>("/me/orgs"),
    ]);
    return { me: me.data, organizations: organizations.data };
  });
}
