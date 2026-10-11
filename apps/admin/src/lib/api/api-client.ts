import { adminApiClient } from "./admin-api-client";

export type { ApiRequestOptions, ApiResult } from "@banijjik/web-client";

/** The generic client lives in @banijjik/web-client; this is its configuration for the admin audience. */
export const apiFetch = adminApiClient.apiFetch;
